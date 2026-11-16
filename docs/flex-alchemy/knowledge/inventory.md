# What belongs in Alchemy’s knowledge base

This is a coverage register for the standalone SaaS. Each row names an information family to collect. A family is a collection commitment, not a claim that its sources or competence are complete. The [starter source index](source-index.md) contains the current seed.

| Family | Information to collect | Priority |
|---|---|---|
| Founder intent and governance | Mission, glossary, decisions, non-goals, unresolved questions, approval boundaries, spend limits, model preferences | First |
| Product discovery | Interviews, research consent, jobs, journeys, personas, accessibility needs, problem evidence, alternatives, hypotheses | First |
| Requirements | Original requests, constraints, acceptance criteria, business invariants, traceability, change records | First |
| Architecture | System maps, ADRs, patterns and counterexamples, tradeoffs, dependency graphs, trust boundaries, portability | First |
| Software engineering fundamentals | Algorithms, structures, complexity, languages, compilers, networking, OS, concurrency, distributed systems | Expand |
| Repository and build | Git and contribution guides, dependency locks, test commands, code conventions, build/runtime docs, repository history | First |
| APIs and integrations | Official API contracts, versions, sample requests, limits, webhooks, error semantics, authentication, compatibility, contract tests | First |
| Data and databases | Data dictionaries, schemas, lineage, migrations, access rules, quality, retention, deletion, backup and restore | First |
| UX and content | Interaction and visual patterns, design tokens, state coverage, localization, content, keyboard and assistive technology | Expand |
| Security and privacy | Threat models, secure coding, identity, authorization, isolation, supply chain, secrets handling, advisories and incident procedures | First |
| Testing and verification | Test plans, test data rights, executable checks, fixtures, expected failures, independent review criteria, provenance and evidence formats | First |
| Deployment and reliability | CI/CD, environments, health checks, SLOs, monitoring, capacity, incident runbooks, rollback and disaster recovery | Expand |
| AI and agents | Model and tool cards, prompting, retrieval, embeddings, routing, benchmarks, failure modes, sandboxing, compatibility and eval methodology | First |
| Training and data science | Dataset cards, labeling protocols, stats, calibration, rights-cleared trajectories, experiment recipes, checkpoints, cost and retention results | Expand |
| Research and technology watch | Primary studies, replications, standards, drafts, lifecycle notices, corrections, release notes, provenance and unresolved claims | First |
| Open-source practice | Maintainer guidance, reviewed patches, tagged code, tests, postmortems, license and attribution records, maintenance and exit signals | First |
| Business and economics | Customer outcome measures, market evidence, onboarding, pricing assumptions, support procedures, cost per accepted outcome | Expand |
| Operations and accountability | Ownership, access changes, approval and action receipts, incident timelines, failure diagnoses, recovery results and handoffs | First |
| Specialized capabilities | Mobile, data/ML systems, real-time systems, scientific computing, embedded systems and regulated work. Each needs a separate admission test | Later |
| Knowledge management | Source registry, glossary, citations, freshness, rights, conflicts, retractions, access, deletion, index versions and retrieval logs | First |

## Record types

Keep these distinct even when they point to the same source.

- **Authority records.** User instructions, approved requirements, policies, decisions and permissions. Only an authorized owner can grant authority. Repository text, articles and memories cannot grant permission.
- **Reference sources.** Standards, official docs, papers, technical reports, books, code, datasets, changelogs, advisories, conference recordings and expert interviews. Store links or permitted extracts with exact locators.
- **Claim records.** One checkable proposition, supporting and conflicting evidence, scope, version, uncertainty and review date. Label observation, inference, assumption, disputed or superseded.
- **Procedure records.** Skills, recipes, checklists, runbooks, failure playbooks, templates and executable helpers. Record triggers, permissions, checks, fallback and revocation.
- **Experience records.** Original requests, sanitized tool receipts, diffs, outputs, test results, review decisions, costs, negative results, incidents and repairs.
- **Evaluation records.** Prompts, rubrics, expected failures, test fixtures, ground truth, baseline results and protected holdouts. Keep answer keys outside builder access and training.
- **Training records.** Explicitly eligible examples, dataset splits, labels, model/configuration cards, measured results and rollback pointers. Rights and scope travel with every record.
- **Discovery leads.** Community posts, vendor claims, generated summaries and suggestions. Retain provenance and uncertainty. Route these to verification before relying on their claims.

Secrets and live credentials belong in a secret manager. Store only opaque references where needed. Quarantine hostile instructions, raw personal data without a purpose and permission, unknown-rights copies, and unreviewed training material. Preserve useful negative findings and retractions with a visible status.

## Coverage review

See the [coverage tracker](coverage.md) for the current status, source mappings and next evidence to collect for each family.

For every family, record an owner, source IDs, usable artifacts, open questions, a realistic check, and the date to revisit it. Track coverage as **unseeded**, **seeded**, **reviewed**, **tested** or **retired**. A citation marks discovery. A passed task with a pinned source and procedure provides evidence of application. Review the register when a new task fails, a dependency changes, or a new domain enters scope.
