const fullSha = /^[a-f0-9]{40}$/;
const repositoryUrl = /^https:\/\/github\.com\/([a-z0-9](?:[a-z0-9-]{0,38}))\/([a-z0-9_.-]{1,100})\/?$/i;

export function parseGitHubSource(repository, revision) {
  const match = repositoryUrl.exec(repository);
  const commit = revision.toLowerCase();
  if (!match || ['.', '..'].includes(match[2]) || !fullSha.test(commit)) return null;
  return { owner: match[1].toLowerCase(), repository: match[2].toLowerCase(), commit };
}

export async function verifyGitHubSource(source, request = fetch) {
  const { owner, repository, commit } = source;
  const endpoint = 'https://api.github.com/repos/' + owner + '/' + repository + '/git/commits/' + commit;
  try {
    const response = await request(endpoint, {
      redirect: 'error', signal: AbortSignal.timeout(5000),
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
      if (size > 262_144) return { status: 'unavailable' };
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data?.sha !== commit || !fullSha.test(data.tree?.sha ?? '')) return { status: 'unavailable' };
    return { status: 'verified', tree: data.tree.sha };
  } catch {
    return { status: 'unavailable' };
  }
}
