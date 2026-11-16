import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { retrieve } from './retrieve.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const navigationChecker = join(here, 'packs/repository-verification/verify-navigation.ps1');
const catalogChecker = join(here, 'packs/repository-verification/verify-catalog.mjs');
function verificationTool(id = 'navigation') {
  if (id === 'navigation') return {
    checker: navigationChecker, description: 'Verify the four required knowledge navigation links and their targets',
    executable: 'pwsh', args: ['-NoProfile', '-File', navigationChecker, '-KnowledgeRoot'],
  };
  if (id === 'catalog') return {
    checker: catalogChecker, description: 'Verify source catalog fields, unique IDs and HTTPS references',
    executable: process.execPath, args: [catalogChecker],
  };
  throw new Error('Unknown verification tool');
}
const files = [
  'README.md', 'source-index.md', 'inventory.md', 'admission.md',
  'packs/repository-verification/SKILL.md',
];
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const load = path => JSON.parse(readFileSync(path, 'utf8'));
function save(path, data) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  try {
    linkSync(temporary, path);
  } finally {
    unlinkSync(temporary);
  }
}
const snapshot = root => Object.fromEntries(files.map(file => [file, hash(join(root, file))]));

function prepare(directory, candidate, request) {
  if (!candidate || !request.trim()) throw new Error('prepare requires a candidate path and request');
  const toolId = process.env.ALCHEMY_CHECK || 'navigation';
  const tool = verificationTool(toolId);
  const sources = retrieve(request);
  const candidateRoot = resolve(candidate);
  const expectedFiles = snapshot(candidateRoot);
  mkdirSync(directory);
  const artifact = join(directory, 'artifact');
  mkdirSync(join(artifact, 'packs/repository-verification'), { recursive: true });
  for (const file of files) copyFileSync(join(candidateRoot, file), join(artifact, file));
  if (JSON.stringify(snapshot(artifact)) !== JSON.stringify(expectedFiles)) {
    throw new Error('Candidate changed during snapshot');
  }
  save(join(directory, 'prepared.json'), {
    version: 1, request, sources, preparedAt: new Date().toISOString(),
    ...(process.env.ALCHEMY_MISSION_ID ? { missionId: process.env.ALCHEMY_MISSION_ID } : {}),
    ...(process.env.ALCHEMY_MISSION_REVISION ? { missionRevision: Number(process.env.ALCHEMY_MISSION_REVISION) } : {}),
    toolId, check: tool.description,
    checkerSha256: hash(tool.checker), files: expectedFiles,
  });
  console.log('Prepared. Resume with verify and the same run directory.');
}

function inspect(directory) {
  const prepared = load(join(directory, 'prepared.json'));
  const tool = verificationTool(prepared.toolId);
  const artifact = join(directory, 'artifact');
  if (prepared.version !== 1 ||
      JSON.stringify(snapshot(artifact)) !== JSON.stringify(prepared.files) ||
      hash(tool.checker) !== prepared.checkerSha256) {
    throw new Error('Prepared inputs changed. Prepare a new run.');
  }
  if (JSON.stringify(retrieve(prepared.request)) !== JSON.stringify(prepared.sources)) {
    throw new Error('Retrieved records changed. Prepare a new run.');
  }
  return prepared;
}

function status(directory) {
  const prepared = inspect(directory);
  const evidencePath = join(directory, 'evidence.json');
  const evidence = existsSync(evidencePath) ? load(evidencePath) : null;
  if (evidence && (evidence.checkerSha256 !== prepared.checkerSha256 ||
      JSON.stringify(evidence.files) !== JSON.stringify(prepared.files) ||
      evidence.status !== (evidence.exitCode === 0 ? 'passed' : 'failed'))) {
    throw new Error('Evidence does not match the prepared run');
  }
  console.log(JSON.stringify({
    status: evidence?.status ?? 'prepared',
    request: prepared.request,
    missionId: prepared.missionId ?? null,
    missionRevision: prepared.missionRevision ?? null,
    check: prepared.check,
    toolId: prepared.toolId ?? 'navigation',
    sources: prepared.sources,
    evidence,
  }, null, 2));
}

function verify(directory) {
  const evidencePath = join(directory, 'evidence.json');
  if (existsSync(evidencePath)) throw new Error('Evidence already exists for this run');
  const prepared = inspect(directory);
  const tool = verificationTool(prepared.toolId);
  const artifact = join(directory, 'artifact');
  const result = spawnSync(tool.executable, [...tool.args, artifact], { encoding: 'utf8', timeout: 30_000 });
  if (result.error) throw result.error;
  if (JSON.stringify(inspect(directory)) !== JSON.stringify(prepared)) {
    throw new Error('Checkpoint changed during verification');
  }
  const evidence = {
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr,
    verifiedAt: new Date().toISOString(), checkerSha256: prepared.checkerSha256, files: prepared.files,
  };
  save(evidencePath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = result.status === 0 ? 0 : 1;
}

try {
  const [command, runPath, candidate, ...request] = process.argv.slice(2);
  if (!runPath || !['prepare', 'status', 'verify'].includes(command)) {
    throw new Error('Usage: local-run.mjs prepare <new-run-dir> <candidate-dir> <request> | status <run-dir> | verify <run-dir>');
  }
  if (command === 'prepare') prepare(resolve(runPath), candidate, request.join(' '));
  else if (command === 'status') status(resolve(runPath));
  else verify(resolve(runPath));
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
