import { createHash } from 'node:crypto';
import { verifyArchiveEnvelope } from './archive-verification.mjs';

const fullSha = /^[a-f0-9]{40}$/;
const filePreviewLimit = 65_536;
const archiveLimit = 8 * 1024 * 1024;
const repositoryUrl = /^https:\/\/github\.com\/([a-z0-9](?:[a-z0-9-]{0,38}))\/([a-z0-9_.-]{1,100})\/?$/i;

export function parseGitHubSource(repository, revision) {
  const match = repositoryUrl.exec(repository);
  const commit = revision.toLowerCase();
  if (!match || ['.', '..'].includes(match[2]) || !fullSha.test(commit)) return null;
  return { owner: match[1].toLowerCase(), repository: match[2].toLowerCase(), commit };
}

async function readGitHubObject({ owner, repository }, kind, sha, request, signal, byteLimit) {
  const endpoint = 'https://api.github.com/repos/' + owner + '/' + repository + '/git/' + kind + '/' + sha;
  try {
    const response = await request(endpoint, {
      redirect: 'error', signal,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Flex-Alchemy' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { status: response.status === 404 ? 'missing' : 'unavailable' };
    }
    if (!response.body) return { status: 'unavailable' };
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > byteLimit) return { status: 'too-large' };
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return data?.sha === sha ? { status: 'verified', data } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function verifyGitHubSource(source, request = fetch) {
  const result = await readGitHubObject(source, 'commits', source.commit, request, AbortSignal.timeout(5000), 262_144);
  if (result.status !== 'verified') return { status: result.status };
  if (!fullSha.test(result.data.tree?.sha ?? '')) return { status: 'unavailable' };
  return { status: 'verified', tree: result.data.tree.sha };
}

export async function inspectGitHubDirectory(source, root, segments, request = fetch) {
  const signal = AbortSignal.timeout(8000);
  let sha = root;
  for (const segment of [...segments, null]) {
    const result = await readGitHubObject(source, 'trees', sha, request, signal, 1_048_576);
    if (result.status !== 'verified') return { status: result.status };
    if (result.data.truncated === true) return { status: 'too-large' };
    const entries = result.data.tree;
    if (!Array.isArray(entries) || entries.some(entry =>
      typeof entry?.path !== 'string' || !entry.path || entry.path.includes('/') ||
      !fullSha.test(entry.sha ?? '') || !['blob', 'tree', 'commit'].includes(entry.type))) {
      return { status: 'unavailable' };
    }
    if (segment === null) return { status: 'verified', entries };
    const child = entries.find(entry => entry.type === 'tree' && entry.path === segment);
    if (!child) return { status: 'missing' };
    sha = child.sha;
  }
}

export function isRegularGitHubFile(entry) {
  return entry.type === 'blob' && ['100644', '100755'].includes(entry.mode);
}

export async function readGitHubTextFile(source, entry, request = fetch) {
  if (!isRegularGitHubFile(entry)) return { status: 'unsupported' };
  if (entry.size > filePreviewLimit) return { status: 'too-large' };
  const result = await readGitHubObject(source, 'blobs', entry.sha, request, AbortSignal.timeout(5000), 106_496);
  if (result.status !== 'verified') return { status: result.status };
  const { content, encoding, size } = result.data;
  if (encoding !== 'base64' || typeof content !== 'string' || !Number.isInteger(size) || size < 0) {
    return { status: 'unavailable' };
  }
  if (size > filePreviewLimit) return { status: 'too-large' };
  const base64 = content.replace(/[\r\n]/g, '');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length !== size || bytes.toString('base64') !== base64 ||
    (Number.isInteger(entry.size) && entry.size !== size)) return { status: 'unavailable' };
  const sha = createHash('sha1').update('blob ' + size + '\0').update(bytes).digest('hex');
  if (sha !== entry.sha) return { status: 'unavailable' };
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { status: 'unsupported' };
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return { status: 'unsupported' };
  return { status: 'verified', size, text, bytes };
}

export async function readGitHubArchive({ owner, repository, commit }, request = fetch) {
  const name = owner + '/' + repository;
  const signal = AbortSignal.timeout(12_000);
  const headers = { 'User-Agent': 'Flex-Alchemy', Accept: 'application/vnd.github+json' };
  try {
    const redirect = await request('https://api.github.com/repos/' + name + '/tarball/' + commit, {
      redirect: 'manual', signal, headers,
    });
    await redirect.body?.cancel();
    if (redirect.status !== 302) return { status: redirect.status === 404 ? 'missing' : 'unavailable' };
    const target = new URL(redirect.headers.get('location'));
    const path = target.pathname.toLowerCase();
    if (target.origin !== 'https://codeload.github.com' || target.username || target.password || target.search ||
      !['/' + name + '/legacy.tar.gz/' + commit, '/' + name + '/tar.gz/' + commit].includes(path)) {
      return { status: 'unavailable' };
    }
    const response = await request(target.href, { redirect: 'error', signal, headers: { 'User-Agent': 'Flex-Alchemy' } });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return { status: response.status === 404 ? 'missing' : 'unavailable' };
    }
    if (Number(response.headers.get('content-length')) > archiveLimit) {
      await response.body.cancel();
      return { status: 'too-large' };
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > archiveLimit) return { status: 'too-large' };
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks, size);
    if (size < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) return { status: 'unavailable' };
    const verification = await verifyArchiveEnvelope(bytes, commit);
    if (verification !== 'verified') return { status: verification };
    return { status: 'verified', bytes };
  } catch {
    return { status: 'unavailable' };
  }
}
