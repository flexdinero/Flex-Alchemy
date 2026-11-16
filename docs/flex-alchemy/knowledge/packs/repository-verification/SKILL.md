---
name: repository-verification
description: Verify a bounded repository change with a pinned acceptance check and a deliberate negative control.
---

Use when a change has observable acceptance conditions and a safe, isolated test surface. Stop when the required check is unavailable, its authority is unclear, or the test would modify production.

1. Preserve the request, base revision, allowed files and acceptance contract before checking the candidate.
2. Read K06 and K07 for benchmark design and limitations, and K11 for the relationship between sources and artifacts. Apply only the portions relevant to the task.
3. Copy the relevant candidate files to a disposable directory. Record SHA-256 digests for the candidate and checker. The builder does not choose the pass condition after seeing results.
4. Run the acceptance check on the candidate. Preserve its exit code and actual output.
5. In the disposable copy, plant a realistic fault that violates the same acceptance condition. Run the same checker. Restore and rerun to confirm the result tracks the artifact.
6. Report tested scope, environment, exact digests, results, omissions and who ran the check. Distinguish a separate checker process from independent human review.
