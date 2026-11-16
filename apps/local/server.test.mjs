import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('mission and its verification receipt survive a server restart', { timeout: 30_000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'alchemy-missions-'));
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = 'http://127.0.0.1:' + port;
  let server;
  async function start() {
    server = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
      env: { ...process.env, ALCHEMY_LOCAL_STORE: store, ALCHEMY_LOCAL_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = once(server, 'exit').then(([code]) => { throw new Error('Server exited: ' + code); });
    await Promise.race([once(server.stdout, 'data'), exited]);
  }
  async function stop() {
    if (server && server.exitCode === null && server.signalCode === null) {
      const stopped = once(server, 'exit');
      server.kill();
      await stopped;
    }
  }
  const post = (path, fields, source = origin) => fetch(origin + path, {
    method: 'POST', redirect: 'manual', headers: { Origin: source }, body: new URLSearchParams(fields),
  });
  const page = async path => {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    return response.text();
  };
  async function waitForReceipt(path, expected = 'PASS all 4 required links') {
    for (let attempt = 0; attempt < 70; attempt++) {
      const content = await page(path);
      if (content.includes(expected)) return content;
      await delay(150);
    }
    assert.fail('Queued verification did not publish a passing receipt');
  }
  try {
    const legacy = new DatabaseSync(join(store, 'missions.sqlite'));
    try {
      legacy.exec(`CREATE TABLE missions (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, goal TEXT NOT NULL, acceptance TEXT NOT NULL, created_at TEXT NOT NULL
      ) STRICT`);
      legacy.prepare('INSERT INTO missions VALUES (?, ?, ?, ?, ?)').run(
        '00000000-0000-4000-8000-000000000001', 'Existing mission', 'Preserve intent', 'Keep prior criteria', '2026-11-01T00:00:00Z',
      );
    } finally {
      legacy.close();
    }
    await start();
    for (const [path, status] of [['/healthz', 'alive'], ['/readyz', 'ready']]) {
      const probe = await fetch(origin + path);
      assert.equal(probe.status, 200);
      assert.equal(probe.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await probe.json(), { status });
    }
    assert.match(await page('/missions'), /Existing mission/);
    assert.match(await page('/projects'), /Local project/);
    assert.match(await page('/projects/local'), /Existing mission/);
    assert.equal((await post('/projects', { name: 'Missing purpose' })).status, 400);
    const project = await post('/projects', { name: 'Release readiness', purpose: 'Verify the founder journey' });
    assert.equal(project.status, 303);
    const projectPath = project.headers.get('location');
    assert.match(await page(projectPath), /Verify the founder journey/);
    assert.match(await page(projectPath), /No missions yet/);
    assert.equal((await post('/missions', {})).status, 400);
    assert.equal((await post('/missions', {}, 'http://example.test')).status, 403);
    const mission = await post('/missions', { projectId: projectPath.split('/').at(-1), title: 'Review knowledge', goal: 'Check <navigation>', acceptance: 'Four required links resolve' });
    assert.equal(mission.status, 303);
    const missionPath = mission.headers.get('location');
    assert.match(await page(missionPath), /Check &lt;navigation&gt;/);
    assert.ok((await page(projectPath)).includes(missionPath));
    assert.ok(!(await page('/projects/local')).includes(missionPath));
    const runFields = { missionId: missionPath.split('/').at(-1), missionRevision: '1', request: 'Can we use CampaignOS?' };
    const run = await post('/runs', runFields);
    assert.equal(run.status, 303);
    const runPath = run.headers.get('location');
    assert.match(await page(runPath), /scope-decision/);
    assert.equal((await post(runPath + '/verify', {})).status, 303);
    assert.match(await page(runPath), /Withdraw verification/);
    assert.equal((await post(runPath + '/cancel', {})).status, 303);
    assert.equal((await post(runPath + '/verify', {})).status, 303);
    assert.match(await page(runPath), /withdrawn before it started/);
    const withdrawn = await (await fetch(origin + missionPath + '/export')).json();
    assert.equal(withdrawn.runs[0].verificationState, 'cancelled');
    assert.equal(withdrawn.runs[0].evidence, null);
    assert.equal((await post(runPath + '/requeue', {})).status, 303);
    assert.equal((await post(runPath + '/verify', {})).status, 303);
    await waitForReceipt(runPath);
    assert.equal((await post(runPath + '/cancel', {})).status, 409);
    assert.match(await page(missionPath), /Awaiting review/);
    const reviewPath = missionPath + '/review';
    assert.equal((await post(reviewPath, { version: '0', decision: 'accepted' })).status, 400);
    const decision = { version: '0', revision: '1', decision: 'changes-requested', evidence: 'Navigation passed. Mission still needs a <browser> review.' };
    assert.equal((await post(reviewPath, decision)).status, 303);
    assert.equal((await post(reviewPath, decision)).status, 409);
    await stop();
    await start();
    const missionAfterRestart = await page(missionPath);
    assert.ok((await page(projectPath)).includes(missionPath));
    assert.ok(missionAfterRestart.includes(projectPath));
    assert.ok(missionAfterRestart.includes(runPath));
    assert.match(missionAfterRestart, /Changes requested/);
    assert.match(missionAfterRestart, /needs a &lt;browser&gt; review/);
    const version = missionAfterRestart.match(/name="version" value="(\d+)"/)[1];
    assert.equal((await post(reviewPath, { version, revision: '1', decision: 'accepted', evidence: 'Operator checked the criteria.' })).status, 303);
    const history = await page(missionPath);
    assert.match(history, /Accepted by operator/);
    assert.match(history, /Changes requested/);
    const receipt = await page(runPath);
    assert.ok(receipt.includes(missionPath));
    assert.match(receipt, /PASS all 4 required links/);
    const download = await fetch(origin + missionPath + '/export');
    assert.match(download.headers.get('content-disposition'), /^attachment; filename="alchemy-mission-/);
    const bundle = await download.json();
    assert.equal(bundle.coverage, 'complete');
    assert.equal(bundle.mission.acceptance, 'Four required links resolve');
    assert.equal(bundle.project?.id, bundle.mission.project_id);
    assert.equal(bundle.project?.name, 'Release readiness');
    assert.equal(bundle.project?.purpose, 'Verify the founder journey');
    assert.deepEqual(bundle.reviews.map(review => review.decision), ['accepted', 'changes-requested']);
    assert.equal(bundle.runs.length, 1);
    assert.equal(bundle.runs[0].evidence.exitCode, 0);
    assert.equal(bundle.runs[0].missionRevision, 1);
    assert.equal(bundle.runs[0].sources.projectRecords[0].locator, undefined);
    const runId = runPath.split('/').at(-1);
    await appendFile(join(store, runId, 'artifact', 'README.md'), '\nChanged after verification.\n');
    const partial = await (await fetch(origin + missionPath + '/export')).json();
    assert.equal(partial.coverage, 'partial');
    assert.equal(partial.runs[0].status, 'unavailable');
    assert.equal(partial.runs[0].evidence, undefined);
    await writeFile(join(store, runId, 'prepared.json'), '{');
    const unreadable = await (await fetch(origin + missionPath + '/export')).json();
    assert.equal(unreadable.coverage, 'partial');
    assert.equal(unreadable.runs[0].id, runId);
    const checkpointRecovery = await fetch(origin + runPath);
    assert.equal(checkpointRecovery.status, 409);
    const recoveryPage = await checkpointRecovery.text();
    assert.match(recoveryPage, /Prepare a new check/);
    assert.ok(recoveryPage.includes(`href="${missionPath}"`));
    const revision = { revision: '1', title: 'Review knowledge', goal: 'Check navigation', acceptance: 'Verify mobile keyboard navigation' };
    assert.equal((await post(missionPath + '/revise', revision)).status, 303);
    assert.equal((await post(missionPath + '/revise', revision)).status, 409);
    assert.equal((await post('/runs', runFields)).status, 409);
    const revised = await page(missionPath);
    assert.match(revised, /Awaiting review/);
    assert.match(revised, /Verify mobile keyboard navigation/);
    assert.match(revised, /Four required links resolve/);
    const staleReview = { version: revised.match(/name="version" value="(\d+)"/)[1], revision: '1', decision: 'accepted', evidence: 'Old criteria.' };
    assert.equal((await post(reviewPath, staleReview)).status, 409);
    const revisedBundle = await (await fetch(origin + missionPath + '/export')).json();
    assert.deepEqual(revisedBundle.revisions.map(item => item.revision), [2, 1]);
    assert.deepEqual(revisedBundle.reviews.map(item => item.mission_revision), [1, 1]);
    assert.equal((await post('/runs', { request: 'Check', tool: 'unregistered' })).status, 400);
    const queuedRun = await post('/runs', { request: 'Verify recovered queue', tool: 'catalog' });
    assert.equal(queuedRun.status, 303);
    const queuedRunPath = queuedRun.headers.get('location');
    await stop();
    const jobs = new DatabaseSync(join(store, 'missions.sqlite'));
    try {
      assert.equal(jobs.prepare('SELECT attempts FROM verification_jobs WHERE run_id = ?').get(runId).attempts, 1);
      jobs.prepare(`INSERT INTO verification_jobs (run_id, state, requested_at, lease_until, claim_token, attempts)
        VALUES (?, 'running', ?, ?, 'expired-worker', 1)`).run(queuedRunPath.split('/').at(-1), Date.now() - 100, Date.now() - 10);
    } finally {
      jobs.close();
    }
    await start();
    await waitForReceipt(queuedRunPath, 'PASS catalog structure for 23 source records');
    const failureFixture = new DatabaseSync(join(store, 'missions.sqlite'));
    try {
      failureFixture.exec('DROP TABLE verification_jobs');
    } finally {
      failureFixture.close();
    }
    const readiness = await fetch(origin + '/readyz');
    assert.equal(readiness.status, 503);
    assert.equal(readiness.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await readiness.json(), { status: 'unavailable' });
    const liveness = await fetch(origin + '/healthz');
    assert.equal(liveness.status, 200);
    assert.deepEqual(await liveness.json(), { status: 'alive' });
  } finally {
    await stop();
    await rm(store, { recursive: true, force: true });
  }
});
