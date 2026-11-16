import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyCatalog(text) {
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex(line => line.startsWith('| ID | Primary source |'));
  const ids = new Set();
  const failures = [];
  const records = [];
  if (header === -1 || !/^\|(?:\s*:?-+:?\s*\|){4}$/.test(lines[header + 1] ?? '')) {
    failures.push('Missing or invalid source table header.');
  } else {
    for (let i = header + 2; lines[i]?.startsWith('|'); i++) {
      const row = /^\| (K\d+) \| \[([^\]]+)\]\(([^)]+)\) \| ([^|]+) \| ([^|]+) \|$/.exec(lines[i]);
      if (!row || !row.slice(2).every(field => field.trim())) {
        failures.push('Incomplete source row at line ' + (i + 1));
        continue;
      }
      const [, id, title, locator, category, application] = row;
      if (ids.has(id)) failures.push('Duplicate source ID: ' + id);
      ids.add(id);
      const url = URL.canParse(locator) ? new URL(locator) : null;
      if (!url || url.protocol !== 'https:' || url.username || url.password || /\s/.test(locator)) {
        failures.push('Invalid HTTPS reference: ' + id);
      } else records.push({ id, title, locator, category, application });
    }
    if (ids.size === 0) failures.push('Source table contains no records.');
  }
  return { failures, recordCount: ids.size, records };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = readFileSync(join(process.argv[2], 'source-index.md'), 'utf8');
  const { failures, recordCount } = verifyCatalog(text);
  for (const failure of failures) console.log("FAIL " + failure);
  if (failures.length) process.exitCode = 1;
  else console.log("PASS catalog structure for " + recordCount + " source records");
}
