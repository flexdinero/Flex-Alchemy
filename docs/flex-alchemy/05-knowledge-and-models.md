# Living knowledge, model routing, and proprietary training

**Status:** strategy and admission criteria. No model training, dataset ingestion, or background monitoring has been executed.

## 1. Three kinds of learning

| Mechanism | Best use | Main failure mode | Validation |
|---|---|---|---|
| Retrieval and structured memory | Current facts, private project context, authoritative references | Wrong/stale retrieval or poisoned memory | Source correctness, retrieval relevance, scope, freshness |
| Skills and deterministic tools | Repeated procedures and operational standards | Irrelevant trigger, brittle instructions, unsafe scripts | Paired skill/no-skill tests and real outcome checks |
| Weight training | Recurring behavior, specialized judgments, efficient execution | Overfitting, forgetting, contamination, poor economics | Held-out task performance, safety, total cost, rollback |

These mechanisms complement each other. A model cannot reliably retain an ever-changing software ecosystem in its weights. A retrieval system does not automatically teach reliable execution. A skill cannot grant capabilities absent from the model and tools.

## 2. Institutional knowledge system

Create a curated corpus spanning computer science, engineering, human-computer interaction, security, distributed systems, data, AI, statistics, operations, and relevant industry knowledge. Include original research, standards, official documentation, licensed educational materials, code examples, and verified internal outcomes.

For every source retain publisher/authors, title, URL or document ID, publication and retrieval dates, version, license/permission basis, access restrictions, domain, quality notes, retractions/corrections, and links to the claims it supports. Publicly readable material is not automatically licensed for redistribution, model training, or commercial derivative use. Record permitted uses separately for retrieval, storage, redistribution, and training; resolve uncertainty before ingestion for restricted purposes.

Do not bulk-copy entire institutional libraries or assume all open repositories share the same license. Review code, datasets, model weights, and documentation separately. Keep attribution and notices. Obtain qualified review where rights or regulated data are ambiguous; this package makes no jurisdiction-specific legal determination.

Ingestion pipeline: discover → establish provenance and permitted use → parse/OCR → deduplicate → classify → retain source locations → index → evaluate retrieval → publish into the approved corpus. Quarantine instruction-like content and low-quality sources. Maintain deletion propagation into source stores, indexes, caches, and applicable future training manifests.

Prefer hybrid lexical/semantic retrieval, reranking when useful, and precise source excerpts. Add graph relationships only where needed for dependency, decision, or knowledge lineage. Enforce tenant authorization before retrieval. Evaluate citation accuracy, unsupported claims, contradictory sources, missing evidence, and resistance to malicious text.

## 3. Current technology intelligence

Each technology record captures purpose, candidate version, verified date, authoritative sources, compatibility, lifecycle status, security/advisories, license, support, cost assumptions, operational demands, alternatives, and project fit.

An update produces an impact assessment: affected projects, potential benefit, migration effort, compatibility risk, test requirements, rollback feasibility, and urgency. Experimental research and stable standards occupy different statuses. Adopt only when a measured or necessary improvement justifies change.

Use four evidence labels: verified source fact, reasoned inference, unresolved/unknown, and stale. Add "contradicted" and "superseded" states when needed. Context from an old chat is not stronger than a current authoritative artifact. A memory record must never promote untrusted instructions into policy.

Research loops stop when the decision has enough evidence or further research has low expected value. The system cannot investigate every rabbit hole before delivering anything. Preserve low-priority questions in a research backlog with relevance, uncertainty, and a revisit trigger.

## 4. Model routing as measured economics

Route by task, uncertainty, data sensitivity, modality, tool reliability, latency, context needs, budget, and measured success. Maintain exact model identifiers and configuration snapshots in run records. Re-run representative evaluations after model, prompt, skill, tool, or harness changes.

Use capable lower-cost models for bounded extraction, metadata formatting, simple transformations, and deterministic uploads when they meet the quality bar. Use stronger models for ambiguous architecture, difficult debugging, synthesis, and high-impact independent review when evaluation supports the expense. Deterministic code is preferable when inference adds no value.

Minimize **total cost per accepted outcome**, including retries, infrastructure, tools, and review. Use privacy-aware caching and batching where valid. Do not reuse cached evidence across tenants or after relevant inputs change. Provider fallback must preserve required capabilities and privacy constraints; a fallback is not automatically equivalent.

Compare single-agent and specialist configurations experimentally. Multi-model agreement is weak evidence if they share assumptions. Optimize coordination cost, not agent count. Keep an independently evaluated default and promote challengers through canaries.

## 5. Should Flex train its own model?

Yes, preserve this as a serious strategic capability—but begin with a specific measurable gap, not a foundation-model project intended to absorb all human expertise. The strongest initial proprietary asset is likely the combination of verified task histories, failure diagnoses, task-specific skills, acceptance tests, and outcome labels. This is a strategic inference, not a proven business valuation.

Recommended progression:

| Stage | Work | Advance only when |
|---|---|---|
| A: Baseline | Existing frontier/open models with good tools, retrieval, and skills | Representative tasks and failure categories are measured |
| B: Data advantage | Curate authorized traces, artifacts, labels, and difficult counterexamples | Provenance, quality, consent, and train/eval separation are established |
| C: Narrow specialist | Train a router, evaluator assistant, or repeated bounded engineering behavior | Training plausibly addresses the identified failure or cost |
| D: Adapt an existing model | Evaluate SFT/LoRA or other suitable post-training on licensed weights | Candidate improves held-out outcomes without material regressions |
| E: Preference/reward optimization | Use reliable preference labels or executable rewards where justified | Reward validity and hacking resistance are demonstrated |
| F: Distillation and serving | Compress verified capability and optimize deployment | Teacher terms permit use and total serving economics improve |
| G: Continued pretraining or foundation research | Investigate only with a differentiated thesis, corpus, compute, and team | A funded research case beats adaptation alternatives |

Training a broadly competitive foundation model from scratch is not a prerequisite for Alchemy. Do not set a budget or launch training jobs based on this document alone. Estimate compute from the chosen model, tokens, sequence lengths, optimizer, hardware, throughput measurements, and number of experiments—not a generic price guess.

Current warning: OpenAI's documented self-serve fine-tuning availability has changed; do not assume a new account can use older tutorials. Verify a currently supported route or consider suitable open-weight training infrastructure (S12, S31).

## 6. What to train on

Use permissioned examples containing the user objective, relevant context, permitted tools, constraints, observable actions, resulting artifacts, verifier outcomes, cost, and human corrections. Include failed attempts with accurate failure labels and the verified repair, not merely fluent "successful" answers. Do not collect hidden model reasoning as a requirement.

Protect private client code, credentials, personal data, and commercial information. Cross-customer training is opt-in with explicit permitted use; default tenant isolation applies. Separate externally sourced material, human-produced examples, generated candidates, and independently verified synthetic tasks in provenance.

Research papers teach concepts; executable tasks teach whether the system can apply them. Convert selected research into reproducible experiments, implementation constraints, and evaluation cases. Do not equate citation volume with mastery.

## 7. Data and model release gates

1. Dataset has lineage, permitted-use records, deduplication, quality checks, and redaction.
2. Split by repository/project and time where appropriate, not random near-duplicate snippets.
3. Freeze hidden test sets; keep evaluation materials out of training and skill references.
4. Compare against the same baseline harness, tools, budgets, and environments over repeated trials.
5. Measure task success, instruction adherence, calibrated abstention, security, privacy leakage, general-capability retention, latency, and total cost.
6. Audit reward hacking: passing tests by deleting functionality, editing the grader, leaking solutions, or falsifying evidence.
7. Version dataset, base model, adapter, optimizer settings, training code, and serving configuration; retain model/data cards.
8. Shadow, canary, observe, and roll back if regressions appear.

Published work shows risks from indiscriminate recursive use of generated data (S32); this is not a blanket prohibition on synthetic data. Use independently checked synthetic tasks alongside reliable original data. Track representativeness and long-tail failures. Fine-tuning/retrieval interactions and forgetting need explicit evaluation (S33).

## 8. The self-improvement boundary

Alchemy may propose improvements to its prompts, skills, code, routing, and models. The production system must not silently rewrite its own authority, protected tests, evidence rules, or success criteria. An independently controlled promotion path evaluates candidate improvements.

AlphaEvolve illustrates the value of verifiable objectives in bounded optimization (S34). Alchemy should apply that pattern where correctness can be checked and use expert judgment where it cannot. Universal autonomous self-improvement remains an unproven ambition, not a platform feature to claim at launch.
