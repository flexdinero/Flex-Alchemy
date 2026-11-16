# Run Alchemy locally

This single-operator pilot connects source lookup, a saved request, a snapshot and a verification receipt. Use Node.js, PowerShell 7 and a local filesystem that supports hard links. Run from the clone root.

```powershell
$knowledge = 'docs/flex-alchemy/knowledge'
$run = Join-Path ([IO.Path]::GetTempPath()) ('alchemy-run-' + [guid]::NewGuid())
node "$knowledge/local-run.mjs" prepare $run $knowledge "Can we use CampaignOS for the pilot? Verify knowledge navigation."
# You can close this terminal after preparation. Keep the path printed below.
$run
node "$knowledge/local-run.mjs" status $run
node "$knowledge/local-run.mjs" verify $run
node "$knowledge/local-run.mjs" status $run
```

Preparation requires a new directory. Inspect `prepared.json` for the original request, source candidates and pinned check. Review the cited documents before acting. To resume later, run the verify command with the same directory from the same checkout. The verifier checks the copied artifacts and the checker against the recorded digests, checks that retrieval returns the same records, then saves the actual exit status and output. An existing receipt ends the run. Prepare a new run for a changed candidate or retry after a failed check.

Exit codes are 0 for success, 1 for a failed check and 2 for an invalid or unavailable run. Preparation interrupted before the checkpoint requires a fresh run directory. A verification interrupted before receipt publication can be retried because this checker only reads files. Use a trusted local directory and trusted checkout. Local hashes detect drift, while a user who can modify the checkpoint and its inputs can rewrite the record. The pilot has no shared tenancy or independent verifier identity.

## Observed pilot on November 9, 2026

The build task was to make the new local workflow discoverable from the knowledge landing page and exercise it against that updated candidate. Alchemy retrieved A01 and P01 for the request and saved the candidates with the run. The four-link check covers the required knowledge links. The new guide is linked separately from the landing page.

| Case | Actual result |
|---|---|
| Prepare, exit, then verify in a fresh process | Exit 0. The saved snapshot and retrieval records were used and all four required links passed |
| Verify the completed run again | Exit 2. The existing evidence file retained its original hash |
| Prepare and verify a copy with the admission link broken | Exit 1. The verifier reported the missing link and saved a failed receipt |
| Edit the snapshot after preparation | Exit 2. The runner detected input drift before creating a receipt |

Node v22.20.0 was used. The accepted landing page SHA-256 was `191d72c01567ccc28d27539c3d0f972a87b326179b2ec364021dc42e0e941279`. The verifier SHA-256 was `f6fc033647daf5d7002f9ed280def767114f3e2f80a9444c001e9a1973f73969`. The checkpoint recovery exercised separate CLI invocations. Forced process termination during verification and concurrent execution were outside this run.
