const fullSha = /^[a-f0-9]{40}$/;
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
