# Admission and quality grades

Grade each **claim or procedure for a stated use**, rather than assigning blanket trust to a publisher. A database manual can be authoritative about documented behavior for its version while the same behavior remains unverified under Alchemy's actual runtime configuration.

| Grade | Qualification | Allowed use |
|---|---|---|
| Q4 · Verified in scope | Reproducible independent evidence tied to a version, environment, test and scope. All hard gates pass | Support an in-scope completion or adoption claim while evidence remains current |
| Q3 · Authoritative reference | Identified primary authority or accepted project decision with verified provenance, locator, scope and version | Ground an applicable claim or guide a test. Project authority requires a separate authorization record |
| Q2 · Credible supporting evidence | Traceable original study, case study, review or maintained implementation with methods and limitations | Inform a comparison or hypothesis. Corroborate consequential claims |
| Q1 · Discovery lead | Traceable but anecdotal, promotional, generated, weakly tested or unconfirmed | Find primary material and propose checks |
| Q0 · Quarantined or excluded | Untraceable, unsafe, out of scope, rejected on rights, fabricated, retracted for the claim, or otherwise unusable | Review in isolation or retain a tombstone. Exclude from active retrieval and training |

A claim can carry a strong evidence grade and a **stale**, **disputed**, **superseded**, or **revoked** status. Those statuses restrict active use regardless of grade. Separate evidence quality from business authority, freshness, permissions and access scope.

For every admission, record:

1. **Identity and provenance.** Stable record ID, title, author/publisher, URL or repository revision, exact section, content digest when stored, publication and check dates.
2. **Fit.** Information type, intended use, domain, task, version range, assumptions, exclusions and failure modes.
3. **Quality.** Authority, directness, reproducibility, independent corroboration, uncertainty and conflicts. Record the reason for the grade.
4. **Rights.** Separate decisions for link, copy, parse, index, quote, redistribute and train. Record license or explicit permission and reviewer. Unknown rights permit only the approved operation.
5. **Safety and access.** Sensitivity, tenant/audience, redaction, retention and instruction-injection checks. Apply scope before retrieval.
6. **Lifecycle.** Owner, status, review trigger, expiration, replacement links and deletion or revocation propagation.

Workflow: discover → register → review rights and access → assess evidence → assign grade and allowed uses → approve or quarantine → publish → monitor → revoke or supersede. Automation can parse records and flag changes. An accountable reviewer handles disputed, safety-sensitive or rights-sensitive promotions. The first source index remains link-only pending per-entry rights and applicability review.

Examples: a tagged official specification can qualify for Q3 within its stated scope. A peer-reviewed result with limited transfer to our workflow can be Q2 for that workflow. A vendor benchmark may be Q1 for a buying decision until corroborated. A verifier's result can qualify for Q4 for the exact tested artifact and checks. None of these grades independently grants training rights.
