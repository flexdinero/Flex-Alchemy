# Flex Alchemy source index

Seed reviewed November 8, 2026. Entries are link-only references for human review and retrieval design. Each source has separate permissions for copying, indexing full text, redistribution and training. Those permissions are unreviewed for this seed. No source contents or model weights were imported.

| ID | Primary source | Class | Alchemy application to test |
|---|---|---|---|
| K01 | [Retrieval-augmented generation](https://arxiv.org/abs/2005.11401) | research | Compare a model with and without targeted external context. |
| K02 | [BEIR](https://arxiv.org/abs/2104.08663) | evaluation | Keep keyword retrieval as a baseline and compare ranked relevance across task types. |
| K03 | [BERGEN](https://arxiv.org/abs/2407.01102) | evaluation | Measure retrieval, reranking and generation changes separately. |
| K04 | [SkillsBench](https://www.skillsbench.ai/skillsbench.pdf) | evaluation | Compare curated skills, no skill and candidate skills on held-out tasks. |
| K05 | [Agent Skills specification](https://agentskills.io/specification) | format | Package a narrowly scoped procedure with optional scripts and references. |
| K06 | [SWE-bench Verified](https://www.swebench.com/verified) | evaluation | Require executable checks against real repository changes. Keep Alchemy's private cases separate. |
| K07 | [Separating signal from noise in coding evaluations](https://openai.com/index/separating-signal-from-noise-coding-evaluations/) | evaluation | Review test validity, ambiguity and contamination before trusting aggregate scores. |
| K08 | [METR time horizon limitations](https://metr.org/notes/2026-01-22-time-horizon-limitations/) | evaluation | Measure scoped task reliability and avoid extrapolating to full projects. |
| K09 | [OWASP ASVS](https://asvs.owasp.org/) | security | Translate applicable application security requirements into negative tests. |
| K10 | [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | security | Map secure development practices to release evidence and accountable owners. |
| K11 | [SLSA v1.2](https://slsa.dev/spec/v1.2/) | supply chain | Bind an artifact to source and build provenance. Evaluate applicable verification controls. |
| K12 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | accessibility | Map relevant criteria to browser checks and manual review. |
| K13 | [Google SRE book](https://sre.google/sre-book/table-of-contents/) | operations | Build runbooks for service objectives, incident response and recovery. |
| K14 | [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | database | Verify default denial, owner bypass and runtime roles with actual PostgreSQL. |
| K15 | [LoRA](https://arxiv.org/abs/2106.09685) | training | Try a reversible adapter before considering updates to all base weights. |
| K16 | [Direct Preference Optimization](https://arxiv.org/abs/2305.18290) | training | Consider preference training only after reliable labeled comparisons exist. |
| K17 | [Ai2 OLMo 2](https://allenai.org/olmo2) | open research | Study reproducible training artifacts. Benchmark specific checkpoints before selection. |
| K18 | [Ai2 Dolma](https://docs.allenai.org/training_data/dolma) | data | Study corpus documentation and provenance. Review rights per component before reuse. |
| K19 | [GOV.UK user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs) | product discovery | Trace observed user needs to a journey and acceptance criteria. |
| K20 | [Lamport on logical clocks](https://lamport.azurewebsites.net/pubs/time-clocks.pdf) | engineering fundamentals | Test whether concurrent event ordering respects causal dependencies. |
| K21 | [OpenAPI Specification v3.2.1](https://spec.openapis.org/oas/v3.2.1.html) | API specification | Validate HTTP operations, response schemas and error cases against a versioned contract. |
| K22 | [GOV.UK service performance data](https://www.gov.uk/service-manual/measuring-success/using-data-to-improve-your-service) | service measurement | Define customer outcome and completion measures before measuring cost per accepted outcome. |
| K23 | [Reproducible Builds definition](https://reproducible-builds.org/docs/definition/) | specialized build engineering | Compare artifact bytes from independent builds using the same specified inputs. |

For admission beyond this seed, record publisher, version or revision, section locator, published and checked dates, local digest if stored, owner, applicability, conflicts, access scope and permissions by use. Treat changes to a rolling URL as candidates until reviewed. Record replacement IDs for superseded sources and propagate revocation into derived indexes, cached context and future dataset manifests.
