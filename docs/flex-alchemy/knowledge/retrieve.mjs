import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const index = readFileSync(new URL('./source-index.md', import.meta.url), 'utf8');
const references = new Map([...index.matchAll(
  /^\| (K\d+) \| \[([^\]]+)\]\((https:\/\/[^)]+)\) \|/gm,
)].map(([, id, title, locator]) => [id, { id, title, locator }]));

const routes = [
  { match: /\b(?:interviews?|user needs|customer pain|discovery)\b/i, ids: ['K19'] },
  { match: /\b(?:causal|logical clocks?|concurrent events?)\b/i, ids: ['K20'] },
  { match: /\b(?:http|openapi|api contract|endpoint|status codes? and response schemas?)\b/i, ids: ['K21'] },
  { match: /\b(?:completion rate|customer outcome|service performance)\b/i, ids: ['K22'] },
  { match: /\b(?:byte.identical|reproducible builds?|artifact bytes|independent builds?[^?!.]*identical files)\b/i, ids: ['K23'] },
  { match: /\b(?:row.level security|rls|database tenant isolation|one customer[^?!.]*another customer|reading rows[^?!.]*different organization)\b/i, ids: ['K14'] },
  { match: /\b(?:keyboard|screen reader|wcag|without a mouse|blind visitor[^?!.]*speech output)\b/i, ids: ['K12'] },
  { match: /\b(?:adapter|lora|fine.tun(?:e|ing))\b/i, ids: ['K15'] },
];

const ruling = {
  id: 'A01',
  title: 'Founder ruling on standalone SaaS scope',
  locator: fileURLToPath(new URL('../11-founder-ruling-standalone-saas.md', import.meta.url)),
  section: 'The ruling',
  role: 'scope-decision',
  sha256: 'bbc8fa0f18ebfaf19c9083a55f731ff8568b054cf1041a077c8aad9cd0e9f5fe',
};
const proposal = {
  id: 'P01',
  title: 'Earlier CampaignOS pilot proposal',
  locator: fileURLToPath(new URL('../06-delivery-and-evaluation.md', import.meta.url)),
  section: 'Start with a falsifiable proof',
  role: 'proposal',
  sha256: '843b0e309db9cbc38aa7040d1b2444c0db88c69806accb1422e319e547da7fd3',
};

export function retrieve(question) {
  const query = question.normalize('NFKC').trim();
  const projectScope = /\b(?:campaignos|standalone|existing (?:project )?presets|other flex products?|products we already own|founder[^?!.]*own business)\b/i.test(query);
  const ids = new Set(routes.filter(({ match }) => match.test(query)).flatMap(route => route.ids));
  const referenceCandidates = [...ids].map(id => {
    const entry = references.get(id);
    if (!entry) throw new Error(`Missing catalog record: ${id}`);
    return entry;
  });
  const projectRecords = projectScope ? [ruling, proposal] : [];
  for (const record of projectRecords) {
    const content = readFileSync(record.locator, 'utf8').replace(/\r\n/g, '\n');
    const digest = createHash('sha256').update(content).digest('hex');
    if (digest !== record.sha256) {
      throw new Error(`Project record changed and requires review: ${record.id}`);
    }
  }
  return {
    status: projectRecords.length || referenceCandidates.length ? 'candidates-found' : 'no-match',
    projectRecords,
    referenceCandidates,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question) {
    console.error('Usage: node retrieve.mjs <question>');
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify(retrieve(question), null, 2));
  }
}
