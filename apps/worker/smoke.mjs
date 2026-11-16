import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const image = process.argv[2] ?? 'flex-alchemy-node-worker';
const temp = resolve(tmpdir());
const repo = mkdtempSync(join(temp, 'alchemy-worker-fixture-'));

function git(...args) {
  const result = spawnSync('git', args, { cwd: repo });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}

function worker(commit, archive, network = 'none') {
  const result = spawnSync('docker', [
    'run', '--rm', '-i', '--network', network, '--read-only',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--memory', '256m', '--pids-limit', '64', '--cpus', '1', image, commit,
  ], { input: archive, timeout: 60_000 });
  assert.ok(result.stdout?.length, result.stderr?.toString() ?? result.error?.message);
  return { code: result.status, ...JSON.parse(result.stdout) };
}

try {
  git('init', '-q');
  for (const [label, value, exitCode] of [['passing', 1, 0], ['failing', 2, 1], ['empty', null, 1]]) {
    if (value !== null) {
      writeFileSync(join(repo, 'proof.test.cjs'), `const test = require('node:test');
const assert = require('node:assert/strict');
test('proof', () => assert.equal(${value}, 1));
`);
    } else {
      git('rm', '-q', 'proof.test.cjs');
    }
    git('add', '-A');
    git('-c', 'user.name=Test Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', label);
    const commit = git('rev-parse', 'HEAD').toString().trim();
    const archive = git('archive', '--format=tar.gz', '--prefix=source/', 'HEAD');
    const observed = worker(commit, archive);
    assert.equal(observed.code, exitCode, JSON.stringify(observed));
    assert.equal(observed.status, label === 'empty' ? 'no-tests' : 'finished', JSON.stringify(observed));
    if (label === 'passing') {
      assert.equal(worker('a'.repeat(40), archive).status, 'wrong-revision');
      assert.equal(worker(commit, archive, 'bridge').status, 'invalid-configuration');
    }
    console.log(label + ' fixture: ' + observed.status + ', exit ' + observed.code);
  }
} finally {
  if (dirname(repo) === temp) rmSync(repo, { recursive: true, force: true });
}
