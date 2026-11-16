import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const knowledge = fileURLToPath(new URL('./', import.meta.url));
const cli = join(knowledge, 'local-run.mjs');
const invoke = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('catalog tool rejects duplicate IDs and invalid links in a pinned snapshot', () => {
  const temp = mkdtempSync(join(tmpdir(), 'alchemy-catalog-'));
  const candidate = join(temp, 'candidate');
  cpSync(knowledge, candidate, { recursive: true });
  const index = join(candidate, 'source-index.md');
  writeFileSync(index, readFileSync(index, 'utf8').replace('| K02 |', '| K01 |').replace('https://arxiv.org', 'http://arxiv.org'));
  const run = join(temp, 'run');
  const prepared = spawnSync(process.execPath, [cli, 'prepare', run, candidate, 'Check catalog'], {
    encoding: 'utf8', env: { ...process.env, ALCHEMY_CHECK: 'catalog' },
  });
  assert.equal(prepared.status, 0, prepared.stderr);
  const receipt = JSON.parse(expectExit(1, 'verify', run));
  assert.match(receipt.stdout, /Duplicate source ID: K01/);
  assert.match(receipt.stdout, /Invalid HTTPS reference: K01/);
  assert.equal(JSON.parse(expectExit(0, 'status', run)).toolId, 'catalog');
});
function expectExit(code, ...args) {
  const result = invoke(...args);
  assert.equal(result.status, code, result.stderr || result.stdout);
  return result.stdout;
}

test('inspect a prepared run, resume verification, and reject stale evidence', () => {
  const temp = mkdtempSync(join(tmpdir(), 'alchemy-status-'));
  const run = join(temp, 'run');
  expectExit(0, 'prepare', run, knowledge, 'Can we use CampaignOS for the pilot?');
  const prepared = JSON.parse(expectExit(0, 'status', run));
  assert.equal(prepared.status, 'prepared');
  assert.equal(prepared.evidence, null);
  assert.deepEqual(prepared.sources.projectRecords.map(record => record.id), ['A01', 'P01']);

  expectExit(0, 'verify', run);
  const completed = JSON.parse(expectExit(0, 'status', run));
  assert.equal(completed.status, 'passed');
  assert.match(completed.evidence.stdout, /PASS all 4 required links/);
  expectExit(2, 'verify', run);
  assert.deepEqual(JSON.parse(expectExit(0, 'status', run)), completed);

  appendFileSync(join(run, 'artifact/README.md'), '\nDeliberate candidate change.\n');
  assert.equal(expectExit(2, 'status', run), '');
});

test('inspect actual failure evidence from a broken candidate', () => {
  const temp = mkdtempSync(join(tmpdir(), 'alchemy-failure-'));
  const candidate = join(temp, 'candidate');
  cpSync(knowledge, candidate, { recursive: true });
  const readme = join(candidate, 'README.md');
  writeFileSync(readme, readFileSync(readme, 'utf8').replace('](admission.md)', '](missing.md)'));

  const run = join(temp, 'run');
  expectExit(0, 'prepare', run, candidate, 'Verify knowledge navigation');
  expectExit(1, 'verify', run);
  const completed = JSON.parse(expectExit(0, 'status', run));
  assert.equal(completed.status, 'failed');
  assert.equal(completed.evidence.exitCode, 1);
  assert.match(completed.evidence.stdout, /Missing navigation link: admission\.md/);
});
