# First repository verification run

- Request: build the first knowledge pack and enumerate the knowledge base with admission and quality rules.
- Base: `0319f181c940e0a55d51c95c956fc6ccd66714bb`. Candidate: local uncommitted knowledge documentation.
- Applied references: K06 and K07 informed the executable acceptance check and negative control. K11 informed the use of digests to tie results to artifacts.
- Acceptance: the knowledge landing page links to the source index, inventory, admission rules and verification skill, and each target exists.
- Environment: Windows, PowerShell 7.6.9. Candidate files were copied into a disposable directory. The same checker ran in a separate PowerShell process against all three states.
- Checker SHA-256: `F6FC033647DAF5D7002F9ED280DEF767114F3E2F80A9444C001E9A1973F73969`.

| Candidate | Landing page SHA-256 | Exit | Observed output |
|---|---|---:|---|
| Original | `1661DA10AC0B062F58E12D236D784089C0E655BB0278235AEA8C4C60D8D9B3E9` | 0 | PASS all 4 required links and targets exist |
| Planted defect: admission link points to a missing filename | `9825E826F32753E78C398175191371F65C155AEADFB871D807BF6412E6679DBA` | 1 | FAIL Missing navigation link: admission.md |
| Restored | `1661DA10AC0B062F58E12D236D784089C0E655BB0278235AEA8C4C60D8D9B3E9` | 0 | PASS all 4 required links and targets exist |

This manual pilot used an executable check run by the same assistant that authored the change. Independent human review, enforced checker isolation, model comparison, and generalization to application code remain untested. The checker covers the four required links and target existence. It does not parse arbitrary Markdown or evaluate the content quality of the target pages.
