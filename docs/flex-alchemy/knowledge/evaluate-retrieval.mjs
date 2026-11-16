import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { retrieve } from './retrieve.mjs';

const casesFile = new URL('./evaluation-cases.json', import.meta.url);
const cases = JSON.parse(readFileSync(casesFile, 'utf8'));
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const equalSet = (left, right) => left.length === right.length && left.every(id => right.includes(id));

const results = cases.map(([question, expectedReferences, expectedProject]) => {
  const result = retrieve(question);
  const references = result.referenceCandidates.map(entry => entry.id);
  const project = result.projectRecords.map(entry => entry.id);
  return {
    question, expectedReferences, expectedProject, references, project,
    passed: equalSet(references, expectedReferences) && equalSet(project, expectedProject),
  };
});
const passed = results.filter(result => result.passed).length;
console.log(JSON.stringify({
  routerSha256: digest(new URL('./retrieve.mjs', import.meta.url)),
  casesSha256: digest(casesFile),
  passed,
  total: results.length,
  results,
}, null, 2));
process.exitCode = passed === results.length ? 0 : 1;
