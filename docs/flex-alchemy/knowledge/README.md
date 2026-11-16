# Flex Alchemy knowledge foundation and model roadmap

Browse the [source index](source-index.md), [coverage inventory](inventory.md), [admission and quality rules](admission.md), and [repository verification skill](packs/repository-verification/SKILL.md).

Use the [local run guide](local-run.md) to save a request, inspect its sources and verify a candidate knowledge snapshot in a fresh process.

November 8, 2026. This plan extends [knowledge and models](../05-knowledge-and-models.md) and [delivery and evaluation](../06-delivery-and-evaluation.md). [The source index](source-index.md) is a real link-only seed. The corpus pipeline, benchmark and training stages below are proposed.

## What to own

Alchemy's durable advantage is knowledge tied to successful and failed work. A public paper gives us a method. An Alchemy record ties a real request to the sources used, the approved procedure, the tools invoked, the result and the check that accepted or rejected it. Own that record and the evaluation suite alongside the library.

| Layer | Contents | Authority |
|---|---|---|
| Project truth | Original intent, accepted requirements, decisions, repository state and evidence | Scoped to project and tenant. Conflicts go to the owner |
| Reference library | Primary papers, standards, official docs, maintained code examples and postmortems | Supports claims. Retrieved text has no authority to issue commands |
| Skill library | Versioned playbooks with triggers, contraindications, required permissions, commands and checks | Human approved release, pinned per run and revocable |
| Experience ledger | Task, context and tool receipts, artifacts, costs, failures, fixes and reviewer judgments | Record observed outcomes and uncertainty. Keep private data scoped |
| Evaluation vault | Task prompts, acceptance contracts, planted failures, rubrics and held-out cases | Independent owner. Candidate model and builder cannot change or retrieve answers |
| Model registry | Base, adapter, dataset, configuration, results, limits and rollback target | Release policy controls which task classes may use it |

## Coverage map

Start with the first four rows in depth. Catalog the rest as a coverage map, with a named gap where a pack has yet to be built. A domain pack is ready when someone can use its sources, procedure and tools to pass realistic checks.

| Domain | Knowledge and artifacts to collect | First executable proof |
|---|---|---|
| Intent and product | Requirements, ambiguity, accessibility needs, user research, acceptance examples and decision records | Preserve constraints and surface a contradictory requirement before acting |
| Engineering | Git and OSS contribution conventions, language/runtime docs, system design, APIs, database transactions, migrations, concurrency and compatibility | Review a real change, catch regression, verify on clean checkout |
| Security and privacy | Threat models, trust boundaries, identity, secrets, tenant access, permissions, incident disclosure and data lifecycle | Test unauthorized access, hostile content and protected verifier integrity |
| Verification | Browser, contract, integration, property, mutation and failure tests, human review rubrics and benchmark design | Reject a planted defect with evidence tied to the changed artifact |
| Design and accessibility | Design systems, interaction patterns, keyboard and assistive technology, responsive behavior, localization | Complete core journey by keyboard on representative viewport sizes |
| Deployment and reliability | CI, dependency provenance, observability, backup, recovery, resource limits and runbooks | Interrupt a run, recover and verify durable state |
| AI and data | Retrieval, tool protocols, model evaluation, calibration, prompt injection, labeling, data quality and training reproducibility | Find correct versioned evidence, abstain on unsupported questions, reject malicious text |
| Business and operations | Discovery, support, onboarding, pricing assumptions, usage economics and launch criteria | Trace a proposed feature to measurable outcome and owner decision |
| Specialized domains | Mobile, embedded, real-time, scientific and regulated workflows | Define domain-specific toolchain, qualified reviewer, safety limits and independent admission tests |

Open-source collection should prioritize tagged releases, executable tests, well-documented interfaces, reproducible bug reports and reviewed patch history. Record the upstream revision, dependency and license notices. Extract the invariant and a reproduction before adapting a pattern. A popular repository or an accepted PR alone does not verify suitability for Alchemy.

## How to retrieve and apply knowledge

1. **Ingest with provenance.** Begin with the link index. When permitted, retain exact sections, structured notes and immutable revision identifiers. Scan for duplicates, supersession, secrets and hostile instructions. Assign rights per operation and keep unknown rights out of copying and training.
2. **Classify the request.** Identify task, project, stack version, constraints, stakes and expected proof. Fetch authoritative project decisions and approved policy through separate trusted channels.
3. **Filter before search.** Require correct tenant, audience, status, language and version. Search file names, symbols and text first. Test semantic retrieval and reranking when keyword misses recur. Keep access controls on the source store and derived caches.
4. **Assemble a small evidence packet.** Include the exact source section, version, why it applies, material conflicts and what is missing. Prefer official material for current behavior and primary research for research claims. Stop or ask when uncertainty affects permission or correctness.
5. **Apply through a scoped skill.** Convert a retrieved rule into an explicit action and acceptance check. Use deterministic tooling for known operations. The model can propose actions, while a policy gate controls what tools can do.
6. **Verify and retain.** Attach the changed artifact, test revision, environment, independent result and source IDs to the run. Track whether the retrieved source actually helped. Record a failure category and next action when it did not.

For example, index PostgreSQL's RLS documentation (K14) as a reference. A database security skill asks for proof under the actual runtime role and checks for owner or bypass behavior. An independent test tries to read another tenant's data and records the actual result. A successful test applies to the tested revision and roles.

## Model path

| Stage | What to build or test | Gate |
|---|---|---|
| 0. Instrument | Same base model on a baseline workflow, then with retrieval, then with retrieval and a curated skill | Repeated, paired results on private cases. Keep tools, task and budget fixed where possible |
| 1. Fix the right layer | Improve labels, search filters, source coverage, skills and executable tools | Evidence identifies recurring failures after those improvements |
| 2. Narrow specialist | If evidence supports it, adapt one licensed base for a task such as converting a request into structured acceptance checks or classifying run failures. Benchmark against rules and the cheapest qualified model | Better accepted outcomes or total cost, and no security or quality regression on untouched tasks |
| 3. Deeper adaptation | Consider supervised fine-tuning, then preference training for trustworthy paired judgments or reward optimization for defensible executable objectives | Each additional training method beats its simpler comparator and survives reward-hacking tests |
| 4. Full-weight experiment | Compare full fine-tuning on a licensed base with an adapter. Consider continued pretraining only for a measured gap in durable domain knowledge | Documented rights, compute budget, serving economics, capability retention and rollback |
| 5. Foundation pretraining | Treat training from random initialization as a separate research investment | A differentiated corpus and compute plan can plausibly beat existing bases plus adaptation |

LoRA freezes the base during training and learns a small set of adaptation weights (K15). Full fine-tuning updates the existing base parameters. Continued pretraining gives a base more domain exposure, while supervised and preference training target behavior. The operating rules, project truth and live facts still belong in explicit policy and retrieval. Review base model, dataset, documentation, code and generated-data terms separately. OLMo is a reproducibility reference (K17), with specific checkpoint suitability unresolved.

A training record should include the user objective, authorized context, retrieval source IDs, tool receipts, sanitized artifacts, actual test output, outcome, human correction and permission for training. Collect difficult failures and corrected examples alongside successful work. Exclude private reasoning, secrets and unauthorized client material. Split by repository and time, deduplicate near copies, freeze a hidden test set, version the data and model cards, and use shadow deployment with rollback. Where deletion matters, trace records through future training manifests and assess already trained releases separately.

Use zero-model automation for parsing, checksums, validation and known state transitions. For inference, select the cheapest eligible configuration that meets task-specific quality and security thresholds. Track retries, tools, review and infrastructure in cost per accepted outcome. Obtain the user's approval before calling a higher-complexity model. No pricing or model winner was established by this research.

## Two separate improvement loops

| Loop | Trigger and action | Stop and promotion |
|---|---|---|
| Recover this run | Tool failure, stale source, failing check or interrupted job. Record cause, reretrieve or retry within bounded policy. Reconcile uncertain external effects before repeating them | Stop at success, retry/spend limit, revoked authority or missing evidence. Preserve checkpoint and escalate |
| Improve future runs | Repeated labeled failure or reviewed upstream update. Propose a source, skill, tool, router or model change in an isolated candidate | Replay the failed case, test hidden cases and negative triggers, require independent approval, shadow or canary, monitor and roll back by pinned revision |

Diagnose failures by layer. Wrong facts suggest freshness or retrieval. Correct facts with incorrect steps suggest a skill or tool problem. Repeated behavior failure with correct context and tools can justify training. A failed verification system needs a verifier fix and a protected regression case. Alchemy cannot promote its own change to permissions, protected tests or evaluation thresholds.

## First pilot and evidence

Use the existing doc 06 evaluation design as the parent program. Start with three paired cases that can be run through an existing agent, Git and a test runner before building a SaaS interface.

| Case | Test and expected behavior |
|---|---|
| P01. Conflicting sources | Give an old and current project requirement. Identify the conflict, select the authorized revision or escalate, cite the source precisely |
| P02. Real bounded fix | Repair a real defect in an authorized repo. Compare baseline, retrieval, and retrieval plus a skill against the same protected checks. Reject a planted false fix |
| P03. Poisoned source and interrupted work | Include retrieved text that attempts to change policy. Interrupt an in-progress run. Deny the instruction, resume from persisted records and show which effects were completed |

Record top-result relevance, whether an authoritative source was retrieved, citation and version accuracy, accepted outcomes, false completions, unauthorized attempts, recovery, time, total cost, and reviewer effort. Repeat trials and report raw denominators. Public benchmarks provide external reference points. Private cases determine what Alchemy can claim. Treat any observed unauthorized effect or fabricated verification as a release blocker for the affected task class.

The next build unit is a curated source set, one reviewed skill, one protected acceptance check and one real run record. Git and Markdown are enough to begin. Add a generated structured catalog, keyword index or command-line runner when the pilot identifies a repeatable bottleneck. The index is a seed rather than a comprehensive body of industry knowledge. No retrieval benchmark or training experiment has run.
