import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyCatalog } from '../../docs/flex-alchemy/knowledge/packs/repository-verification/verify-catalog.mjs';

const knowledge = new URL('../../docs/flex-alchemy/knowledge/', import.meta.url);
const checker = await readFile(new URL('packs/repository-verification/verify-catalog.mjs', knowledge));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function catalogSnapshot() {
  const catalog = await readFile(new URL('source-index.md', knowledge));
  return {
    catalog,
    catalogSha256: sha256(catalog),
    checkerSha256: sha256(checker),
  };
}

export function checkCatalog({ catalog, catalogSha256, checkerSha256 }) {
  const { failures, recordCount } = verifyCatalog(catalog.toString('utf8'));
  return { failures, recordCount, catalogSha256, checkerSha256 };
}

export async function catalogRecords() {
  const { catalog, catalogSha256 } = await catalogSnapshot();
  const { records, failures } = verifyCatalog(catalog.toString('utf8'));
  return { records, failures, catalogSha256 };
}
