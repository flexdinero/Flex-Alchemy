import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const image = process.env.ALCHEMY_NODE_WORKER_IMAGE;
const connection = process.env.ALCHEMY_RUNNER_DATABASE_URL;
const once = process.argv[2] === '--once';
const statuses = new Set(['finished', 'timed-out', 'no-tests', 'empty-archive', 'invalid-archive',
  'wrong-revision', 'unsupported-archive', 'too-large']);

async function database(pool, statement, args = []) {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE alchemy_run_client');
    const result = await client.query(statement, args);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}

async function execute(job) {
  const digest = createHash('sha256').update(job.content).digest('hex');
  if (digest !== job.archive_sha256) return { status: 'input-digest-mismatch' };
  const name = 'alchemy-run-' + job.id;
  const args = ['run', '--rm', '--pull=never', '-i', '--name', name, '--network', 'none', '--read-only',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '256m',
    '--pids-limit', '64', '--cpus', '1', image, job.commit_sha];
  try {
    const output = await new Promise((resolve, reject) => {
      const child = execFile('docker', args, { timeout: 60_000, maxBuffer: 900_000 }, (error, stdout) => {
        if (error && error.code !== 1) reject(error);
        else resolve(stdout);
      });
      child.stdin.on('error', () => {});
      child.stdin.end(job.content);
    });
    const receipt = JSON.parse(output);
    if (receipt.commit !== job.commit_sha || receipt.archiveSha256 !== digest || !statuses.has(receipt.status) ||
      (receipt.status === 'finished' && !Number.isInteger(receipt.exitCode) && typeof receipt.signal !== 'string')) {
      return { status: 'invalid-worker-result' };
    }
    return {
      status: receipt.status, commit: job.commit_sha, archiveSha256: digest,
      exitCode: Number.isInteger(receipt.exitCode) ? receipt.exitCode : null,
      signal: typeof receipt.signal === 'string' ? receipt.signal.slice(0, 40) : null,
      output: typeof receipt.output === 'string' ? receipt.output.replaceAll('\0', '�').slice(0, 131_072) : '',
      truncated: receipt.truncated === true,
    };
  } catch {
    return { status: 'worker-process-failed' };
  } finally {
    await new Promise(resolve => execFile('docker', ['rm', '-f', name], { timeout: 5000 }, () => resolve()));
  }
}

let pool;
try {
  const url = new URL(connection);
  if (!/^sha256:[a-f0-9]{64}$/.test(image ?? '') || !['postgres:', 'postgresql:'].includes(url.protocol)
    || [...url.searchParams.keys()].some(key => /^ssl/i.test(key)) || (process.argv.length !== 2 && !once)) {
    throw new Error('Invalid runner configuration');
  }
  pool = new pg.Pool({
    connectionString: connection, ssl: { rejectUnauthorized: true },
    max: 1, connectionTimeoutMillis: 5000, statement_timeout: 10_000, query_timeout: 12_000,
  });
  let stopping = false;
  pool.on('error', () => console.error('Runner database connection failed'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopping = true; });
  do {
    const [job] = await database(pool, 'SELECT * FROM alchemy.claim_archive_test_run()');
    if (job) {
      const result = await execute(job);
      const [receipt] = await database(pool, 'SELECT alchemy.finish_archive_test_run($1,$2,$3) AS recorded',
        [job.id, job.lease_token, JSON.stringify(result)]);
      if (!receipt.recorded) console.error('Runner lease expired before the result was recorded');
    } else if (!once && !stopping) {
      await delay(2500);
    }
  } while (!once && !stopping);
} catch {
  console.error('Node worker dispatch failed');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
