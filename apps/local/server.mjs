import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const knowledge = fileURLToPath(new URL('../../docs/flex-alchemy/knowledge/', import.meta.url));
const cli = join(knowledge, 'local-run.mjs');
const store = process.env.ALCHEMY_LOCAL_STORE ?? join(process.env.LOCALAPPDATA ?? homedir(), 'FlexAlchemy', 'runs');
const port = Number(process.env.ALCHEMY_LOCAL_PORT ?? 4173);
const origin = 'http://127.0.0.1:' + port;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const stylesheet = await readFile(new URL('./style.css', import.meta.url), 'utf8');
await mkdir(store, { recursive: true });
const db = new DatabaseSync(join(store, 'missions.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, goal TEXT NOT NULL,
  acceptance TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS mission_reviews (
  id INTEGER PRIMARY KEY, mission_id TEXT NOT NULL REFERENCES missions(id),
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'changes-requested')),
  evidence TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS mission_reviews_history ON mission_reviews(mission_id, id DESC)`);
db.exec(`CREATE TABLE IF NOT EXISTS mission_revisions (
  mission_id TEXT NOT NULL REFERENCES missions(id), revision INTEGER NOT NULL,
  title TEXT NOT NULL, goal TEXT NOT NULL, acceptance TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (mission_id, revision)
) STRICT`);
db.exec('BEGIN IMMEDIATE');
try {
  db.exec(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, purpose TEXT NOT NULL, created_at TEXT NOT NULL
  ) STRICT`);
  db.prepare('INSERT OR IGNORE INTO projects VALUES (?, ?, ?, ?)').run(
    'local', 'Local project', 'Missions created in the local workspace', new Date().toISOString(),
  );
  if (!db.prepare('PRAGMA table_info(missions)').all().some(column => column.name === 'project_id')) {
    db.exec('ALTER TABLE missions ADD COLUMN project_id TEXT REFERENCES projects(id)');
    db.exec("UPDATE missions SET project_id = 'local'");
  }
  db.exec('CREATE INDEX IF NOT EXISTS missions_by_project ON missions(project_id, created_at)');
  if (!db.prepare('PRAGMA table_info(mission_reviews)').all().some(column => column.name === 'mission_revision')) {
    db.exec('ALTER TABLE mission_reviews ADD COLUMN mission_revision INTEGER NOT NULL DEFAULT 1');
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
const currentMissions = `SELECT m.id, COALESCE(r.title, m.title) AS title,
  COALESCE(r.goal, m.goal) AS goal, COALESCE(r.acceptance, m.acceptance) AS acceptance,
  m.created_at, m.project_id, COALESCE(r.revision, 1) AS revision
  FROM missions m LEFT JOIN mission_revisions r ON r.mission_id = m.id
  AND r.revision = (SELECT MAX(revision) FROM mission_revisions WHERE mission_id = m.id)`;
const listMissions = db.prepare(currentMissions + ' ORDER BY m.created_at DESC, m.id');
const projectMissions = db.prepare(currentMissions + ' WHERE m.project_id = ? ORDER BY m.created_at DESC, m.id');
const findMission = db.prepare(currentMissions + ' WHERE m.id = ?');
const insertMission = db.prepare('INSERT INTO missions (id, title, goal, acceptance, created_at, project_id) VALUES (?, ?, ?, ?, ?, ?)');
const listProjects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC, id');
const findProject = db.prepare('SELECT * FROM projects WHERE id = ?');
const insertProject = db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?)');
const missionReviews = db.prepare('SELECT * FROM mission_reviews WHERE mission_id = ? ORDER BY id DESC');
db.exec(`CREATE TABLE IF NOT EXISTS mission_runs (
  id TEXT PRIMARY KEY, mission_id TEXT NOT NULL REFERENCES missions(id),
  mission_revision INTEGER NOT NULL, request TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT`);
const listMissionRuns = db.prepare('SELECT * FROM mission_runs');
const findMissionRun = db.prepare('SELECT mission_id FROM mission_runs WHERE id = ?');
const recordMissionRun = db.prepare('INSERT INTO mission_runs VALUES (?, ?, ?, ?, ?)');
const revisions = db.prepare(`SELECT 1 AS revision, title, goal, acceptance, created_at FROM missions WHERE id = ?
  UNION ALL SELECT revision, title, goal, acceptance, created_at FROM mission_revisions WHERE mission_id = ?
  ORDER BY revision DESC`);
const insertRevision = db.prepare(`INSERT INTO mission_revisions
  SELECT ?, ? + 1, ?, ?, ?, ? WHERE COALESCE(
    (SELECT MAX(revision) FROM mission_revisions WHERE mission_id = ?), 1
  ) = ?`);
const insertReview = db.prepare(`INSERT INTO mission_reviews (mission_id, decision, evidence, created_at, mission_revision)
  SELECT ?, ?, ?, ?, ? WHERE COALESCE(
    (SELECT MAX(id) FROM mission_reviews WHERE mission_id = ?), 0
  ) = ? AND COALESCE((SELECT MAX(revision) FROM mission_revisions WHERE mission_id = ?), 1) = ?`);
const decisionLabel = decision => decision === 'accepted' ? 'Accepted by operator' : 'Changes requested';

function send(response, status, title, content) {
  const path = (response.req.url ?? '/').split('?')[0];
  const destinations = [
    ['/projects', 'Projects', '▦'],
    ['/missions', 'Missions', '◎'],
    ['/', 'Verification runs', '◇'],
  ];
  const current = path.startsWith('/projects') ? '/projects' : path.startsWith('/missions') ? '/missions' : '/';
  const links = destinations.map(([href, label, icon]) =>
    `<a href="${href}"${status < 400 && href === current ? ` aria-current="${path === href ? 'page' : 'location'}"` : ''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | Flex Alchemy</title>
<link rel="stylesheet" href="/style.css"></head><body class="alchemy-workspace"><a class="skip" href="#main">Skip to content</a>
<aside class="workspace-sidebar"><a class="workspace-brand" href="/"><span class="brand-mark" aria-hidden="true">✦</span><span>Flex <span>Alchemy</span></span></a>
<div class="workspace-identity"><span aria-hidden="true">FA</span><div>Flex Alchemy<small>Local workspace</small></div></div>
<nav aria-label="Workspace">${links}</nav></aside>
<div class="workspace-body"><header class="workspace-topbar"><span>Workspace</span><span aria-hidden="true">›</span><strong>${esc(title)}</strong></header>
<main id="main" tabindex="-1"${status === 200 && destinations.some(([href]) => href === path) ? ' class="workspace-overview"' : ''}>${content}</main></div></body></html>`);
}

const run = (...args) => execute(process.execPath, [cli, ...args], { timeout: 40_000, windowsHide: true });
db.exec(`CREATE TABLE IF NOT EXISTS verification_jobs (
  run_id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK (state IN ('queued','running','finished','error')),
  requested_at INTEGER NOT NULL, lease_until INTEGER, claim_token TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
) STRICT`);
db.exec('BEGIN IMMEDIATE');
try {
  if (!db.prepare('PRAGMA table_info(verification_jobs)').all().some(column => column.name === 'cancelled_at')) {
    db.exec('ALTER TABLE verification_jobs ADD COLUMN cancelled_at INTEGER');
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
const queueJob = db.prepare(`INSERT INTO verification_jobs (run_id, state, requested_at)
  VALUES (?, 'queued', ?) ON CONFLICT(run_id) DO UPDATE SET state = 'queued',
  requested_at = excluded.requested_at, lease_until = NULL, claim_token = NULL, attempts = 0
  WHERE verification_jobs.state = 'error'`);
const findJob = db.prepare(`SELECT CASE WHEN cancelled_at IS NULL THEN state ELSE 'cancelled' END AS state
  FROM verification_jobs WHERE run_id = ?`);
const cancelJob = db.prepare(`UPDATE verification_jobs SET cancelled_at = ?
  WHERE run_id = ? AND state = 'queued' AND cancelled_at IS NULL`);
const requeueCancelledJob = db.prepare(`UPDATE verification_jobs SET cancelled_at = NULL, requested_at = ?
  WHERE run_id = ? AND state = 'queued' AND cancelled_at IS NOT NULL`);
const checkQueueStorage = db.prepare('SELECT run_id FROM verification_jobs LIMIT 1');
const expireJobs = db.prepare(`UPDATE verification_jobs SET state = 'error', claim_token = NULL
  WHERE state = 'running' AND lease_until <= ? AND attempts >= 3`);
const claimJob = db.prepare(`UPDATE verification_jobs SET state = 'running', lease_until = ?,
  claim_token = ?, attempts = attempts + 1 WHERE run_id = (
    SELECT run_id FROM verification_jobs WHERE cancelled_at IS NULL
    AND ((state = 'queued' AND requested_at <= ?) OR (state = 'running' AND lease_until <= ?))
    ORDER BY requested_at, run_id LIMIT 1
  ) RETURNING run_id`);
const finishJob = db.prepare(`UPDATE verification_jobs SET state = ?, lease_until = NULL, claim_token = NULL
  WHERE run_id = ? AND claim_token = ?`);
let workerBusy = false;
async function processVerification() {
  if (workerBusy) return;
  workerBusy = true;
  try {
    const now = Date.now();
    expireJobs.run(now);
    const token = randomUUID();
    const job = claimJob.get(now + 90_000, token, now - 5000, now);
    if (!job) return;
    const directory = join(store, job.run_id);
    try {
      try {
        await run('verify', directory);
      } catch {
        // A completed check can exit nonzero. The receipt determines its outcome.
      }
      const { stdout } = await run('status', directory);
      finishJob.run(JSON.parse(stdout).evidence ? 'finished' : 'error', job.run_id, token);
    } catch {
      finishJob.run('error', job.run_id, token);
    }
  } catch (error) {
    console.error('Verification queue error:', error.code ?? error.name);
  } finally {
    workerBusy = false;
  }
}
function redirect(response, location) {
  response.writeHead(303, { Location: location }).end();
}

async function readRequest(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) return new URLSearchParams();
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

async function savedRuns() {
  const indexed = new Map(listMissionRuns.all().map(row => [row.id, {
    id: row.id, request: row.request, preparedAt: row.created_at,
    missionId: row.mission_id, missionRevision: row.mission_revision,
  }]));
  const entries = (await readdir(store, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && uuid.test(entry.name) && !indexed.has(entry.name));
  const records = await Promise.all(entries.map(async ({ name }) => {
    try {
      const record = JSON.parse(await readFile(join(store, name, 'prepared.json'), 'utf8'));
      return { id: name, request: record.request, preparedAt: record.preparedAt, missionId: record.missionId };
    } catch {
      return { id: name, request: 'Unreadable checkpoint', preparedAt: '' };
    }
  }));
  records.push(...indexed.values());
  records.sort((left, right) => right.preparedAt.localeCompare(left.preparedAt));
  return records;
}

function runList(records) {
  return records.length ? '<ul>' + records.map(record =>
    `<li><a href="/runs/${record.id}">${esc(record.request)}</a></li>`).join('') + '</ul>' : '<p>No runs yet.</p>';
}
const checkPicker = `<label for="verification-tool">Verification tool</label>
<select id="verification-tool" name="tool">
<option value="navigation">Knowledge navigation</option>
<option value="catalog">Source catalog structure</option></select>`;

async function home(response) {
  send(response, 200, 'Runs', `<h1>Verification runs</h1>
<section><h2>Prepare a run</h2><p>Save a request and choose a check to run against a fixed snapshot.</p>
<form method="post" action="/runs"><label for="request">What should Alchemy look up before checking?</label>
<textarea id="request" name="request" rows="4" maxlength="1000" required></textarea>
${checkPicker}
<button>Prepare run</button></form></section>
<section><h2>Saved runs</h2>${runList(await savedRuns())}</section>`);
}

function projects(response) {
  send(response, 200, 'Projects', `<h1>Projects</h1>
<section><h2>Create a project</h2><form method="post" action="/projects">
<label for="name">Project name</label><input id="name" name="name" maxlength="100" required>
<label for="purpose">What is this project for?</label><textarea id="purpose" name="purpose" maxlength="2000" required></textarea>
<button>Create project</button></form></section>
<section><h2>Saved projects</h2><ul>${listProjects.all().map(project =>
  `<li><a href="/projects/${project.id}">${esc(project.name)}</a></li>`).join('')}</ul></section>`);
}

function missions(response, project = null) {
  const rows = project ? projectMissions.all(project.id) : listMissions.all();
  const options = project ? `<input type="hidden" name="projectId" value="${project.id}">` :
    `<label for="project-id">Project</label><select id="project-id" name="projectId">${listProjects.all().map(item =>
      `<option value="${item.id}"${item.id === 'local' ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select>`;
  send(response, 200, project?.name ?? 'Missions', project ?
    `<a href="/projects">All projects</a><h1>${esc(project.name)}</h1><p class="preserve">${esc(project.purpose)}</p>` + form() :
    '<h1>Missions</h1>' + form());
  function form() { return `
<section><h2>Define an outcome</h2><form method="post" action="/missions">
${options}
<label for="title">Mission title</label><input id="title" name="title" maxlength="100" required>
<label for="goal">What should change?</label><textarea id="goal" name="goal" maxlength="2000" required></textarea>
<label for="acceptance">How will you know it worked?</label><textarea id="acceptance" name="acceptance" maxlength="2000" required></textarea>
<button>Save mission</button></form></section>
<section><h2>Saved missions</h2>${rows.length ? '<ul>' + rows.map(row =>
  `<li><a href="/missions/${row.id}">${esc(row.title)}</a></li>`).join('') + '</ul>' : '<p>No missions yet.</p>'}</section>`; }
}

function missionFields(fields) {
  const values = ['title', 'goal', 'acceptance'].map(key => fields.get(key)?.trim() ?? '');
  return values.some((value, index) => !value || value.length > [100, 2000, 2000][index]) ? null : values;
}

async function missionDetail(response, mission) {
  const project = findProject.get(mission.project_id);
  const records = (await savedRuns()).filter(record => record.missionId === mission.id);
  const reviews = missionReviews.all(mission.id);
  const latest = reviews[0];
  const history = reviews.map(review => `<li><strong>${decisionLabel(review.decision)}</strong>
    · Revision ${review.mission_revision}
    <time datetime="${esc(review.created_at)}">${esc(review.created_at)}</time>
    <p class="preserve">${esc(review.evidence)}</p></li>`).join('');
  send(response, 200, mission.title, `<a href="/missions">All missions</a><h1>${esc(mission.title)}</h1>
${project ? `<p>Project: <a href="/projects/${project.id}">${esc(project.name)}</a></p>` : ''}
<p><a href="/missions/${mission.id}/export">Download mission and evidence (JSON)</a></p>
<section><h2>Goal</h2><p class="preserve">${esc(mission.goal)}</p><h2>Acceptance criteria</h2>
<p class="preserve">${esc(mission.acceptance)}</p><p>Revision ${mission.revision}</p>
<details><summary>Edit mission</summary><form method="post" action="/missions/${mission.id}/revise">
<input type="hidden" name="revision" value="${mission.revision}">
<label for="edit-title">Mission title</label><input id="edit-title" name="title" maxlength="100" value="${esc(mission.title)}" required>
<label for="edit-goal">Goal</label><textarea id="edit-goal" name="goal" maxlength="2000" required>${esc(mission.goal)}</textarea>
<label for="edit-acceptance">Acceptance criteria</label><textarea id="edit-acceptance" name="acceptance" maxlength="2000" required>${esc(mission.acceptance)}</textarea>
<button>Save revision</button></form></details>
<details><summary>Revision history</summary><ol>${revisions.all(mission.id, mission.id).map(item =>
  `<li><strong>Revision ${item.revision} · ${esc(item.title)}</strong>
  <p class="preserve">${esc(item.goal)}</p><p class="preserve">${esc(item.acceptance)}</p></li>`).join('')}</ol></details></section>
<section><h2>Prepare a knowledge check</h2><p>This check verifies knowledge navigation. Mission acceptance requires its own evidence.</p>
<form method="post" action="/runs"><input type="hidden" name="missionId" value="${mission.id}">
<input type="hidden" name="missionRevision" value="${mission.revision}">
<label for="request">What should Alchemy look up?</label>
<textarea id="request" name="request" rows="4" maxlength="1000" required></textarea>
${checkPicker}
<button>Prepare run</button></form></section><section><h2>Mission runs</h2>${runList(records)}</section>
<section><h2>Mission review</h2><p class="status">${latest?.mission_revision === mission.revision ? decisionLabel(latest.decision) : 'Awaiting review'}</p>
<p>Compare the result with the mission criteria. Describe what you observed and where the evidence can be found.</p>
<form method="post" action="/missions/${mission.id}/review">
<input type="hidden" name="version" value="${latest?.id ?? 0}">
<input type="hidden" name="revision" value="${mission.revision}">
<label for="review-evidence">Evidence and reasoning</label>
<textarea id="review-evidence" name="evidence" maxlength="2000" required></textarea>
<button name="decision" value="accepted">Accept mission</button>
<button name="decision" value="changes-requested">Request changes</button></form>
${history ? '<h3>Review history</h3><ol>' + history + '</ol>' : ''}</section>`);
}

async function exportMission(response, mission) {
  const history = revisions.all(mission.id, mission.id);
  const reviews = missionReviews.all(mission.id);
  const records = (await savedRuns()).filter(record => record.missionId === mission.id);
  const runs = [];
  for (const { id, missionRevision } of records) {
    try {
      const { stdout } = await run('status', join(store, id));
      const record = JSON.parse(stdout);
      if (record.missionId !== mission.id ||
          (missionRevision !== undefined && record.missionRevision !== missionRevision)) throw new Error('Mission changed');
      const projectRecords = record.sources.projectRecords.map(
        ({ id, title, role, section, sha256 }) => ({ id, title, role, section, sha256 }),
      );
      runs.push({
        id, ...record,
        verificationState: record.evidence ? 'finished' : findJob.get(id)?.state ?? null,
        sources: { ...record.sources, projectRecords },
      });
    } catch {
      runs.push({ id, status: 'unavailable', reason: 'The checkpoint or evidence could not be validated.' });
    }
  }
  const result = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: findProject.get(mission.project_id) ?? null,
    mission,
    revisions: history,
    reviews,
    coverage: runs.some(record => record.status === 'unavailable') ? 'partial' : 'complete',
    runs,
  };
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="alchemy-mission-${mission.id}.json"`,
  }).end(JSON.stringify(result, null, 2) + '\n');
}

async function detail(response, id) {
  let record;
  try {
    const { stdout } = await run('status', join(store, id));
    record = JSON.parse(stdout);
  } catch (error) {
    const linked = findMissionRun.get(id);
    if (!linked) throw error;
    send(response, 409, 'Run unavailable', `<h1>Run unavailable</h1>
<p>The saved checkpoint or evidence could not be validated. Return to the mission to try again.</p>
<a href="/missions/${esc(linked.mission_id)}">Prepare a new check</a>`);
    return;
  }
  const links = record.sources.referenceCandidates.map(source =>
    `<li><a href="${esc(source.locator)}">${esc(source.title)}</a></li>`).join('');
  const project = record.sources.projectRecords.map(source =>
    `<li><strong>${esc(source.title)}</strong><br>${esc(source.role)} · ${esc(source.section)}<br><code>${esc(source.locator)}</code></li>`).join('');
  const evidence = record.evidence;
  const job = findJob.get(id);
  const active = job?.state === 'queued' || job?.state === 'running';
  const mission = uuid.test(record.missionId ?? '') ? findMission.get(record.missionId) : null;
  send(response, 200, 'Run detail', `<a href="/">All runs</a><h1>Run detail</h1>
  ${mission ? `<p>Mission: <a href="/missions/${mission.id}">${esc(mission.title)}</a> · ${record.missionRevision ? 'Revision ' + esc(record.missionRevision) : 'Revision unrecorded'}</p>` : ''}
<p class="status">${esc(evidence ? record.status : job?.state ?? record.status)}</p><section><h2>Request</h2><p>${esc(record.request)}</p></section>
<section><h2>Sources</h2>${links || project ? '<ul>' + project + links + '</ul>' : '<p>No matching sources.</p>'}</section>
<section><h2>Verification</h2><p>${esc(record.check)}</p>
${evidence ? `<p>Exit code ${esc(evidence.exitCode)} · <time datetime="${esc(evidence.verifiedAt)}">${esc(evidence.verifiedAt)}</time></p>
<pre>${esc(evidence.stdout + evidence.stderr)}</pre><details><summary>File hashes and full receipt</summary><pre>${esc(JSON.stringify(evidence, null, 2))}</pre></details>` :
  active ? `<p>Verification is ${job.state}. You can leave this page and return later.</p><a href="/runs/${id}">Refresh status</a>
  ${job.state === 'queued' ? `<form method="post" action="/runs/${id}/cancel"><button>Withdraw verification</button></form>` : ''}` :
  job?.state === 'cancelled' ? `<p>Verification was withdrawn before it started.</p>
  <form method="post" action="/runs/${id}/requeue"><button>Queue verification again</button></form>` :
  `${job?.state === 'error' ? '<p>Verification ended without a usable receipt. Check the workspace and retry.</p>' : ''}
  <form method="post" action="/runs/${id}/verify"><button>${job?.state === 'error' ? 'Retry verification' : 'Run verification'}</button></form>`}</section>`);
}

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (request.headers.host !== '127.0.0.1:' + port ||
      (request.method === 'POST' && request.headers.origin !== origin)) {
    send(response, 403, 'Access denied', '<h1>Access denied</h1><p>Open the workspace from its local address.</p>');
    return;
  }
  const path = request.url;
  const match = /^\/runs\/([^/]+)(\/verify|\/cancel|\/requeue)?$/.exec(path);
  const missionPath = /^\/missions\/([^/]+)(\/review|\/export|\/revise)?$/.exec(path);
  const projectPath = /^\/projects\/([^/]+)$/.exec(path);
  try {
    if (request.method === 'GET' && (path === '/healthz' || path === '/readyz')) {
      let status = 'alive';
      let code = 200;
      if (path === '/readyz') {
        try {
          checkQueueStorage.get();
          status = 'ready';
        } catch {
          status = 'unavailable';
          code = 503;
        }
      }
      response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ status }));
    } else if (request.method === 'GET' && path === '/style.css') {
      response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' }).end(stylesheet);
    } else if (request.method === 'GET' && path === '/') {
      await home(response);
    } else if (request.method === 'GET' && path === '/missions') {
      missions(response);
    } else if (request.method === 'GET' && path === '/projects') {
      projects(response);
    } else if (request.method === 'POST' && path === '/projects') {
      const fields = await readRequest(request);
      const name = fields.get('name')?.trim() ?? '';
      const purpose = fields.get('purpose')?.trim() ?? '';
      if (!name || name.length > 100 || !purpose || purpose.length > 2000) {
        send(response, 400, 'Project needs details', '<h1>Enter a project name and purpose</h1><a href="/projects">Return to projects</a>');
      } else {
        const id = randomUUID();
        insertProject.run(id, name, purpose, new Date().toISOString());
        redirect(response, '/projects/' + id);
      }
    } else if (request.method === 'GET' && projectPath) {
      const project = findProject.get(projectPath[1]);
      if (project) missions(response, project);
      else send(response, 404, 'Project unavailable', '<h1>Project unavailable</h1><a href="/projects">Return to projects</a>');
    } else if (request.method === 'POST' && path === '/missions') {
      const fields = await readRequest(request);
      const values = missionFields(fields);
      if (!values) {
        send(response, 400, 'Mission needs details', '<h1>Mission needs details</h1><p>Enter a title, goal and acceptance criteria within their length limits.</p><a href="/missions">Return to missions</a>');
        return;
      }
      const projectId = fields.get('projectId') ?? 'local';
      if (!findProject.get(projectId)) {
        send(response, 404, 'Project unavailable', '<h1>Project unavailable</h1><a href="/projects">Return to projects</a>');
        return;
      }
      const id = randomUUID();
      insertMission.run(id, ...values, new Date().toISOString(), projectId);
      redirect(response, '/missions/' + id);
    } else if (missionPath && uuid.test(missionPath[1])) {
      const mission = findMission.get(missionPath[1]);
      if (!mission) {
        send(response, 404, 'Mission unavailable', '<h1>Mission unavailable</h1><a href="/missions">Return to missions</a>');
      } else if (request.method === 'GET' && !missionPath[2]) {
        await missionDetail(response, mission);
      } else if (request.method === 'GET' && missionPath[2] === '/export') {
        await exportMission(response, mission);
      } else if (request.method === 'POST' && missionPath[2] === '/revise') {
        const fields = await readRequest(request);
        const values = missionFields(fields);
        const expected = fields.get('revision');
        const back = `<a href="/missions/${mission.id}">Return to mission</a>`;
        if (!values || !/^[1-9]\d*$/.test(expected ?? '') || !Number.isSafeInteger(Number(expected))) {
          send(response, 400, 'Revision incomplete', '<h1>Enter a title, goal and acceptance criteria</h1>' + back);
        } else if (insertRevision.run(mission.id, Number(expected), ...values, new Date().toISOString(), mission.id, Number(expected)).changes === 0) {
          send(response, 409, 'Mission changed', '<h1>Mission changed</h1><p>Reopen the mission before editing again.</p>' + back);
        } else redirect(response, '/missions/' + mission.id);
      } else if (request.method === 'POST' && missionPath[2] === '/review') {
        const fields = await readRequest(request);
        const evidence = fields.get('evidence')?.trim() ?? '';
        const decision = fields.get('decision');
        const version = fields.get('version');
        const revision = fields.get('revision');
        const back = `<a href="/missions/${mission.id}">Return to mission</a>`;
        if (!['accepted', 'changes-requested'].includes(decision) || !evidence || evidence.length > 2000 ||
            !/^\d+$/.test(version ?? '') || !Number.isSafeInteger(Number(version)) ||
            !/^[1-9]\d*$/.test(revision ?? '') || !Number.isSafeInteger(Number(revision))) {
          send(response, 400, 'Review incomplete', '<h1>Review incomplete</h1><p>Choose a decision and describe your evidence.</p>' + back);
        } else if (insertReview.run(mission.id, decision, evidence, new Date().toISOString(), Number(revision),
            mission.id, Number(version), mission.id, Number(revision)).changes === 0) {
          send(response, 409, 'Review changed', '<h1>Review changed</h1><p>Reopen the mission and review the latest decision before trying again.</p>' + back);
        } else redirect(response, '/missions/' + mission.id);
      } else send(response, 405, 'Method unavailable', '<h1>Action unavailable</h1><a href="/missions">Return to missions</a>');
    } else if (request.method === 'POST' && path === '/runs') {
      const fields = await readRequest(request);
      const question = fields.get('request')?.trim();
      const missionId = fields.get('missionId') ?? '';
      const toolId = fields.get('tool') ?? 'navigation';
      if (!['navigation', 'catalog'].includes(toolId)) {
        send(response, 400, 'Tool unavailable', '<h1>Select an available verification tool</h1><a href="/">Return to runs</a>');
        return;
      }
      if (!question || question.length > 1000) {
        send(response, 400, 'Request required', '<h1>Enter a request of 1 to 1,000 characters</h1><a href="/">Return to runs</a>');
        return;
      }
      const mission = uuid.test(missionId) ? findMission.get(missionId) : null;
      if (missionId && !mission) {
        send(response, 404, 'Mission unavailable', '<h1>Mission unavailable</h1><a href="/missions">Return to missions</a>');
        return;
      }
      if (mission && fields.get('missionRevision') !== String(mission.revision)) {
        send(response, 409, 'Mission changed', `<h1>Mission changed</h1><p>Reopen the mission before preparing a run.</p><a href="/missions/${mission.id}">Return to mission</a>`);
        return;
      }
      const id = randomUUID();
      if (mission) recordMissionRun.run(id, mission.id, mission.revision, question, new Date().toISOString());
      await execute(process.execPath, [cli, 'prepare', join(store, id), knowledge, question], {
        timeout: 40_000, windowsHide: true, env: {
          ...process.env, ALCHEMY_CHECK: toolId, ALCHEMY_MISSION_ID: missionId,
          ALCHEMY_MISSION_REVISION: String(mission?.revision ?? ''),
        },
      });
      redirect(response, '/runs/' + id);
    } else if (match && uuid.test(match[1])) {
      const [, id, action] = match;
      if (request.method === 'GET' && !action) await detail(response, id);
      else if (request.method === 'POST' && action === '/cancel') {
        if (cancelJob.run(Date.now(), id).changes === 0 && findJob.get(id)?.state !== 'cancelled') {
          send(response, 409, 'Verification no longer queued', `<h1>Verification is no longer queued</h1><a href="/runs/${id}">Return to run</a>`);
        } else redirect(response, '/runs/' + id);
      } else if (request.method === 'POST' && (action === '/verify' || action === '/requeue')) {
        const { stdout } = await run('status', join(store, id));
        if (!JSON.parse(stdout).evidence) {
          if (action === '/requeue') requeueCancelledJob.run(Date.now(), id);
          else queueJob.run(id, Date.now());
        }
        redirect(response, '/runs/' + id);
        void processVerification();
      } else send(response, 405, 'Method unavailable', '<h1>Action unavailable</h1><a href="/">Return to runs</a>');
    } else send(response, 404, 'Page unavailable', '<h1>Page unavailable</h1><a href="/">Return to runs</a>');
  } catch (error) {
    const missing = error.stderr?.includes('ENOENT');
    const changed = error.stderr?.includes('Prepare a new run');
    const message = missing ? 'The run checkpoint or one of its files is missing.' :
      changed ? 'The saved inputs changed. Prepare a new run.' :
      'The workspace could not complete this action. Check the local process and try again.';
    send(response, missing ? 404 : changed ? 409 : 500, 'Run unavailable', `<h1>Run unavailable</h1><p>${message}</p><a href="/">Return to runs</a>`);
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log('Flex Alchemy is running at ' + origin);
  const worker = setInterval(processVerification, 1000);
  worker.unref();
  server.once('close', () => clearInterval(worker));
  void processVerification();
});
