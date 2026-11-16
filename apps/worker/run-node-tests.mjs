import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { inventoryArchive } from '../hosted/archive-verification.mjs';

const [commit] = process.argv.slice(2);
const maxArchive = 8 * 1024 * 1024;
const maxOutput = 128 * 1024;
const timeout = 45_000;

async function run() {
  if (process.platform !== 'linux' || process.getuid() === 0 || !/^[a-f0-9]{40}$/.test(commit ?? '') ||
    process.argv.length !== 3 || Object.values(networkInterfaces()).flat().some(address => !address.internal)) {
    return { status: 'invalid-configuration' };
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > maxArchive) return { status: 'archive-too-large' };
    chunks.push(chunk);
  }
  const archive = Buffer.concat(chunks, length);
  const archiveSha256 = createHash('sha256').update(archive).digest('hex');
  const base = { commit, archiveSha256 };
  const destination = await mkdtemp('/tmp/alchemy-source-');
  const source = await inventoryArchive(archive, commit, destination);
  if (source.status !== 'verified' || !source.root) {
    return { ...base, status: source.status === 'verified' ? 'empty-archive' : source.status };
  }

  const cwd = join(destination, source.root);
  await mkdir(cwd, { recursive: true });
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap'], {
    cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', TMPDIR: '/tmp', CI: 'true' },
  });
  const output = [];
  let retained = 0;
  let truncated = false;
  function capture(chunk) {
    const remaining = maxOutput - retained;
    if (chunk.length > remaining) truncated = true;
    if (remaining <= 0) return;
    const included = chunk.subarray(0, remaining);
    retained += included.length;
    output.push(included);
  }
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  let timer;
  try {
    const completion = await new Promise(resolve => {
      child.once('error', () => resolve({ status: 'runner-error' }));
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
      timer = setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
          if (error.code !== 'ESRCH') child.kill('SIGKILL');
        }
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
        resolve({ status: 'timed-out' });
      }, timeout);
    });
    const text = Buffer.concat(output, retained).toString('utf8');
    const status = completion.status ?? (completion.exitCode === 0 && /^# tests 0$/m.test(text) ? 'no-tests' : 'finished');
    return { ...base, ...completion, status, output: text, truncated };
  } finally {
    clearTimeout(timer);
  }
}

const result = await run().catch(() => ({ status: 'runner-error' }));
process.exitCode = result.status === 'finished' && result.exitCode === 0 ? 0 : 1;
await new Promise(resolve => process.stdout.write(JSON.stringify(result) + '\n', resolve));
