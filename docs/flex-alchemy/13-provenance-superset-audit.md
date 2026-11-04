# Provenance & Superset Audit Matrix — Zero-Loss Union Merge v3.0

**Auditor:** Cosmo (Meta Muse) · **Date:** 2026-11-04 · **Merge directive:** Flex, 2026-11-04 (Zero-Loss Superset Architectural Synthesis & Union Merge).

## A. How to read this audit — the three-layer zero-loss guarantee

1. **Verbatim preservation layer (absolute):** Source A (Codex package docs 01–09, package README, MASTER_PROMPT v2.0) and Source C (doc 10) are **byte-unchanged** in this repository — the merge added files and edited none of theirs (verifiable: `git status` / `git diff` at the merge commit shows only additions). Source B (Gemini Argon) was added as a **byte-identical copy**: sha256 `611f0cde78dca8fce6e296740cea09337034c0253a1c2050fadf7c7bb6fe9303` for both Flex's uploaded file and `sources/gemini-argon-master-blueprint-and-prompt.md`, verified at merge time. Source D (doc 11, Founder Ruling) arrived during the merge (commit `66f5dcc`) and is likewise unchanged. **Even if a synthesis sentence below were imperfect, no concept from any source can be lost — the full originals are in the repo.**
2. **Synthesis layer:** `12-unified-superset-architecture.md` (the union architecture) and `MASTER_PROMPT_V3.md` (the union prompt) were built section-by-section as `Merged(X) = Unique(A_X) ∪ Unique(B_X) ∪ Unique(C_X) ∪ Unique(D) ∪ Enhanced_Union(Shared)`, with alternate names preserved as aliases.
3. **This audit layer:** every source file, part, and section is mapped below to its union location(s). "Preserved verbatim" means the original file itself; "Union §" means the concept also appears, merged, in doc 12 / the v3 prompt.

## B. File-level provenance

| Source file | Origin | Disposition in the union |
|---|---|---|
| Repo `README.md` ("The true missing link…") | Flex | Unchanged. |
| `docs/flex-alchemy/README.md` (package index, 8 central decisions) | Source A | Unchanged in content; the union adds docs 12, 13, MASTER_PROMPT_V3, and `sources/` alongside it (central decisions 1–8 are all carried into Union §2, §4, §11, §12, §15 — e.g., "persistent control system around interchangeable models" → §2/§4; "skills as versioned, evaluated software dependencies" → §12; "separate builder, verifier, and authority" → §2/§10/§13.1; "deliver one complete, recoverable journey first" → §14/§15). |
| `01-system-blueprint.md` | Source A | Preserved verbatim. Union mapping in §C.2. |
| `02-skills-and-commands.md` | Source A | Preserved verbatim. Union §12 (+ §5, §13). |
| `03-autonomous-operations.md` | Source A | Preserved verbatim. Union §13 (+ §10.5 protected verifier). |
| `04-founder-experience.md` | Source A | Preserved verbatim. Union §17. |
| `05-knowledge-and-models.md` | Source A | Preserved verbatim. Union §6.5, §11. |
| `06-delivery-and-evaluation.md` | Source A | Preserved verbatim. Union §10.5, §15, §18. |
| `07-technology-decisions.md` | Source A | Preserved verbatim. Union §16. |
| `08-research-sources.md` (S01–S34) | Source A | Preserved verbatim; normative in the union by inclusion (Union §16.5); individual sources cited throughout doc 12 (S03 §12.4, S05–S07 §9.3/§16.1, S12 §11.4/§16.1, S22–S23 §13.4/§16.1, S25 §16.1, S27 §17.6, S28 §13.3, S31 §11.4, S32–S34 §11.4). |
| `09-coverage-matrix.md` (O01–O27, N01–N19, G01–G14) | Source A | Preserved verbatim. Every O/N/G ID's *content* is carried in the union via its expanded location (the matrix's own "Expanded location" column points at docs 01–07, whose union mappings are §C.2 below); G01–G14 map: G01→§4.B/§10.5 (E05), G02→§4.B/§13.3, G03→§10.5, G04→§12, G05→§6.3/§8/§10.5 (E10), G06→§13.1/§17.3, G07→§11.4, G08→§9.4, G09→§10.5, G10→§13.2, G11→§11.4, G12→§7.8/§13.2 (Retirement)/§17.8, G13→§16.1/§16.5, G14→§15.3. |
| `MASTER_PROMPT.md` (v2.0) | Source A | Preserved verbatim; superseded as the working prompt by MASTER_PROMPT_V3 (union of v2.0 + Source B Part IV). All v2.0 sections map into V3: Mission/quality→V3 §1–2; Establish the truth→V3 §3; Durable state→V3 §6.B/§10; Research & knowledge→V3 §8; Skills & commands→V3 §9; Plan & execute→V3 §6/§14; Authority & security→V3 §11; Continuous operation→V3 §15; Proprietary intelligence→V3 §16; Founder experience & Flex identity→V3 §17/§1; Verification & reporting→V3 §12; First action→V3 §18. |
| `10-cosmo-verification-review.md` | Source C | Preserved verbatim. Verification findings → Union §0/§1.2 framing; Objection 1 → **withdrawn by Source D** (Union §15.0); Objection 2 → **reframed by Source D** (Union §15.0/§15.3); Objection 3 → kept as information only (Union §11.3); Coordination protocol → Union §22. |
| `11-founder-ruling-standalone-saas.md` | Source D (Flex, via Cosmo) | Preserved verbatim; governs Union §15.0, §15.2, §15.3, §18.5, §19 R5/R7, and V3 §1 (entity boundary) + §18. |
| Uploaded Gemini MD (Parts I–V, 1,235 lines, 137,147 bytes) | Source B | Byte-identical copy at `sources/gemini-argon-master-blueprint-and-prompt.md`. Union mapping in §C.1. |
| `12-unified-superset-architecture.md` | This merge (Cosmo) | The union architecture. |
| `MASTER_PROMPT_V3.md` | This merge (Cosmo) | The union prompt. |
| `13-provenance-superset-audit.md` | This merge (Cosmo) | This audit. |

## C. Section-level provenance

### C.1 Source B (Gemini Argon) — every part and section

| Source B location | Content | Union location |
|---|---|---|
| Mission statement | Platform definition | Doc 12 §1 (opening) · V3 §1 |
| Part I §1 | The core gap (5 "cannot tell" bullets; human vs. platform responsibilities) | Doc 12 §1.1 · V3 §1 |
| Part I §2 | Practical "one-shot" definition; 3 grounded truths; 6 Non-Negotiable Operating Aims | Doc 12 §1.2, §1.3 · V3 §1, §2 |
| Part I §3 | 6 frontier-model flaws + structural cures (table) | Doc 12 §1.4 (upper table) |
| Part I §4 | Target Capability Matrix — 7 portfolio startups with required capabilities | Doc 12 §1.5 · V3 §1 (benchmark list) |
| Part II §1 | 7 core capabilities + closed-loop diagram | Doc 12 §2 · V3 §4 |
| Part II §2 | Vision Translator; implied questions; 9 input streams; 12-Part Blueprint; traceability chain; HTLL example | Doc 12 §3, §3.1, §3.2, §3.3 · V3 §5 |
| Part II §3 | Development Director A–E (DAG, durable state ×9, dynamic oversight, loop-breaking, ADRs ×6) | Doc 12 §4.A–E · V3 §6 |
| Part II §4 | 14 Specialist Capability Teams (full table) | Doc 12 §5.1 · V3 §7 |
| Part II §5 | Living Technology Intelligence: 13 categories, 12-field record, epistemic classification, safe update protocol | Doc 12 §6.1–6.4 · V3 §8 |
| Part II §6 | 7 Connected Dictionaries/Guides: Plain-Language Dictionary (+worked example), Product Dictionaries (5 products, all terms), Architecture Pattern Library (12), Engineering Playbooks (12), Design Playbooks (12), Failure & Recovery Library (6 fields + privacy rule), Evidence & Decision Library (9 record types) | Doc 12 §7.1–7.7 · V3 §9 |
| Part II §7 | 5-Pillar Project Brain (all sub-bullets per pillar) + epistemic rule | Doc 12 §8 · V3 §10 |
| Part II §8 | Execution Harness: 14 tool capabilities; isolation/least-privilege/prompt-injection defense; supported integration standards | Doc 12 §9.1–9.3 · V3 §10 |
| Part II §9 | Independent Adversarial Verification: Gauntlet A–F, 10 Honest Status Labels, Release Evidence Package | Doc 12 §10.1, §10.3, §10.6 · V3 §12 |
| Part II §10 | 8-Dimension Scorecard; private evaluations vs. public benchmarks; North-Star Metric | Doc 12 §18.1, §18.3, §18.2 · V3 §12 |
| Part II §11 | Dynamic Model & Agent Selection; 8-Step Routing Loop; new-model adoption criteria (8) | Doc 12 §11.1, §11.2 · V3 §13 |
| Part II §12 | Speed: 6 levers (foundations list, parallelization, vertical slices + slice chain, Day-1 risk proofs ×5, safe reuse, automated verification) | Doc 12 §14 · V3 §14 |
| Part II §13 | Founder Command Center: 8 core views; Interactive AI Activity Feed (6 sample commands); Decision Request Cards | Doc 12 §17.1–17.3 · V3 §17 |
| Part II §14 | Where a human is still essential (6 responsibilities) | Doc 12 §17.7 · V3 §17 (6 touchpoints) |
| Part II §15 | End-to-end HTLL walkthrough (Steps 1–5) | Doc 12 §15.3 · (V3 §14 slice chain) |
| Part II §16 | 5-Phase Master Engineering Plan (Phases 1–5 with milestone goals) | Doc 12 §15.1 mapping · V3 §18 |
| Part II §17 | 10 Platform Success Metrics; adversarial stress-testing protocol | Doc 12 §18.2, §18.4 · V3 §12 |
| Part III §1 | 10 Principal Engineering Archetypes with deterministic mechanisms (incl. polyglot stack table, strict-linter settings, named tools: Hypothesis/fast-check/proptest, Stryker/cargo-mutants, Semgrep/CodeQL/Gitleaks, Trivy/OSV-Scanner, Terraform/Pulumi/Kubernetes, Prometheus/Grafana) | Doc 12 §5.2 (archetypes 1–10; Archetype 1 also §3.1; Archetype 9 also §13.5) · V3 §7 |
| Part III §2 | 6 Foundational Engineering Artifacts & concrete tooling stack (table) | Doc 12 §20 (table reproduced in full) |
| Part III §3 | Skill system: 5-component skill definition; Autonomous Skill Synthesizer (4 trigger classes); 10 slash commands (full table) | Doc 12 §12.1, §12.4, §12.5 · V3 §9 |
| Part III §4 | 7 Autonomous Perpetual Closed Loops (full detail per loop) | Doc 12 §13.2 · V3 §15 |
| Part III §5 | Formal verification (TLA+/Quint; Dafny/Verus/Kani/Lean 4) + 3-Layer Protocol Stack (MCP / A2A / WebMCP·ANP·OpenAPI·FIX·Webhooks) | Doc 12 §10.4, §9.3 · V3 §10, §12.F |
| Part III §6 | Proprietary Model Foundry "Alchemy-Core": Stage 1 corpus (institutions, codebases, post-mortems), Stage 2 Execution-Verified Trajectories, Stage 3 CPT→SFT→RLVR/GRPO→DPO (+ Epistemic Integrity Reward), Stage 4 MoE/LoRA specialist fleet; model names (Core, Reasoner, Verifier, Quant) | Doc 12 §11.4 · V3 §16 |
| Part III §7 | Day in the Life: Morning 60-Second Briefing / Overnight Autonomous Ledger; Speaking Vision into Reality (drawdown example); One-Click Visual Proof / Live Proof Drawer; 3-Minute Decision Queue | Doc 12 §17.5 · V3 §17 |
| Part IV | Complete copy-paste Master Prompt, §§1–11 (mission & ecosystem, 6 aims, 7 capabilities, Vision Translator, Director ×5, 14 Teams & 10 Archetypes, Living Tech Intelligence, 7 knowledge layers + Skill Registry, 5-Pillar Brain & 14-Tool Harness & protocol stack, Verification & labels & scorecard & KPIs, 7 Loops & Foundry & Command Center) | Merged line-by-line into MASTER_PROMPT_V3 §§1–18 (V3 §4←IV§3; §5←IV§4; §6←IV§5; §7←IV§6; §8←IV§7; §9←IV§8; §10←IV§9; §12←IV§10; §15/§16/§17←IV§11) and Doc 12 throughout |
| Part V | The Zero-Loss Merge Directive itself (6 rules) | Executed by this merge; method recorded in Doc 12 §0 and this audit; the directive text remains verbatim in the Source B file |

### C.2 Source A (Codex package) — every document and section

| Source A location | Content | Union location |
|---|---|---|
| Doc README | Status framing; 8 central decisions; what is/isn't complete; quality promise | Doc 12 §0, §1.2, §2 (see §B row) |
| 01 §1 | Mission and honest quality contract (6 bullets + no-universal-guarantee) | Doc 12 §1.2 · V3 §1 |
| 01 §2 | 13-row gap table | Doc 12 §1.4 (lower table) |
| 01 §3 intro + flow | Control system with replaceable execution; module flow incl. Policy & Action Gateway | Doc 12 §2 |
| 01 §3A | Intent & product understanding (intake, contradiction precedence, change requests) | Doc 12 §3.1 · V3 §3, §5 |
| 01 §3B | Persistent Project Brain: storage model + 12 core records table | Doc 12 §8 |
| 01 §3C | Durable director: state machine, leases/fencing/idempotency/effect reconciliation, evidence contract | Doc 12 §4.B · V3 §6.B |
| 01 §3D | Specialist capabilities (full specialty list, narrow contracts, ownership, genuine independence) | Doc 12 §5 (layering paragraph) · V3 §7 |
| 01 §3E | Repository composition & migration (+ composition gate) | Doc 12 §9.4 · V3 §10 |
| 01 §3F | Execution & integration substrate (incl. per-connector protocol negotiation) | Doc 12 §9.1, §9.3 · V3 §10 |
| 01 §3G | Evidence, release & operations (artifact-bound evidence, expiry, deployment as state transition) | Doc 12 §10.5, §10.6 |
| 01 §4 | Knowledge breadth: competency map, capability packs, admission tests | Doc 12 §6.6 · V3 §8 |
| 01 §5 | Business & product completeness catalog; Flex identity rules (black/white + toggle + lime; per-product activity feed; CampaignOS/FlexIA ownership) | Doc 12 §7.8, §1.5 · V3 §1, §7 (team 13) |
| 01 §6 | What makes it one ecosystem | Doc 12 §21 |
| 02 §1 | Skill subsystem: distinctions (skill/tool/command/agent/workflow/model), Agent Skills baseline, registry field set, lifecycle, signature caveat | Doc 12 §12.1, §12.2 · V3 §9 |
| 02 §2 | Automatic discovery & economical context (selector evaluation, pinning, collision/conflict detection) | Doc 12 §12.3 · V3 §9 |
| 02 §3 | Skill Factory (9 steps) + evaluator-protection rules + SkillsBench caution | Doc 12 §12.4 · V3 §9 |
| 02 §4 | Command design + 21-command catalog with boundaries; typed schemas, idempotency, job IDs | Doc 12 §12.5 · V3 §9 |
| 02 §5 | Initial skill families (10, with proof standards) | Doc 12 §12.6 |
| 02 §6 | Distribution & portability (+ acceptance criteria) | Doc 12 §12.7 |
| 03 §1 | Autonomy model: common loop contract; no endless loops | Doc 12 §13.1 · V3 §15 |
| 03 §2 | Operating envelopes (5 modes); standing authorization specificity; per-action-class autonomy | Doc 12 §13.1 · V3 §11 |
| 03 §3 | 12-loop inventory (trigger/evidence/stop-rule for each) | Doc 12 §13.2 |
| 03 §4 | Healing state machine + incident practice (incl. irreversible effects, one owner, fencing, PROBE) | Doc 12 §13.3 · V3 §15 |
| 03 §5 | CSO/CISO capability + control list | Doc 12 §13.4 · V3 §11 |
| 03 §6 | Protect the system that judges the system (+ watchdog) | Doc 12 §10.5 · V3 §11, §12 |
| 03 §7 | Growth & learning without goal drift (3 loops; experiment contract; CampaignOS lineage; training-feed discipline) | Doc 12 §13.2 · V3 §15 |
| 03 §8 | Cost & operational discipline (budget reservation, caps, recovery capacity) | Doc 12 §13.5 · V3 §15 |
| 04 §1 | One place to direct the lifecycle; feed-first home; WCAG 2.2 AA (S27) | Doc 12 §17.1, §17.6 |
| 04 §2 | First-time setup (6 steps) | Doc 12 §17.4 · V3 §17 |
| 04 §3 | Daily home screen (8 areas table) | Doc 12 §17.1 |
| 04 §4 | A normal day (illustrative brief; "show me what you actually finished"; scoped phone request; bounded recovery vs. containment) | Doc 12 §17.5 |
| 04 §5 | Decisions & approval design (full card contract, digest binding, fatigue discipline, revocation) | Doc 12 §17.3 · V3 §17 |
| 04 §6 | Three layers of detail (founder/operator/expert) | Doc 12 §17.6 |
| 04 §7 | The trust experience (5 questions per claim; blocker explanation; specialist handoff) | Doc 12 §17.7 · V3 §17 |
| 04 §8 | Acceptance tests for the experience (8 tests; real people, not only personas) | Doc 12 §17.8 |
| 05 §1 | Three kinds of learning (table) | Doc 12 §11.4 (closing frame) · V3 §16 |
| 05 §2 | Institutional knowledge system (rights discipline, ingestion pipeline, retrieval evaluation) | Doc 12 §6.5 · V3 §8 |
| 05 §3 | Current technology intelligence (record fields; impact assessment; 6 epistemic labels incl. contradicted/superseded; research stopping rule) | Doc 12 §6.2–6.4 · V3 §8 |
| 05 §4 | Model routing as measured economics (total cost per accepted outcome, fallback caveats, agreement caveat) | Doc 12 §11.2 · V3 §13 |
| 05 §5 | Train-our-own-model staged progression A–G (+ fine-tuning availability warning S12/S31) | Doc 12 §11.4 · V3 §16 |
| 05 §6 | What to train on (permissioned examples, failed attempts, tenant isolation, provenance separation) | Doc 12 §11.4 · V3 §16 |
| 05 §7 | Data & model release gates (8 gates; synthetic-data nuance S32/S33) | Doc 12 §11.4 · V3 §16 |
| 05 §8 | Self-improvement boundary (protected authority/tests/evidence; AlphaEvolve S34) | Doc 12 §11.4 · V3 §16 |
| 06 §1 | Falsifiable proof; CampaignOS lead-workflow test; HTLL caution | Doc 12 §15.3 |
| 06 §2 | Build in dependency order: Stages 0–8 with exit evidence | Doc 12 §15.1 · V3 §18 |
| 06 §3 | First implementation backlog B01–B15 | Doc 12 §15.2 |
| 06 §4 | Completion & release gates (10 gate classes) | Doc 12 §10.5 · V3 §12 |
| 06 §5 | Evaluation corpus (20-task pilot design; cases E01–E20 in full) | Doc 12 §10.5 (design + full case enumeration; case texts verbatim in Source A file) |
| 06 §6 | Metrics that reflect actual value (12 defined metrics + reporting rules) | Doc 12 §18.2 · V3 §12 |
| 06 §7 | Operating targets & open decisions (unresolved choices list) | Doc 12 §18.5 |
| 07 §1 | Current options (7 candidates table) + stacking warning + pilot evaluation rule | Doc 12 §16.1 |
| 07 §2 | Updates that change earlier assumptions (ADK 2.0, MCP/A2A versions, Skills-over-MCP, MS Agent Framework succession, OpenAI lifecycle changes, OTel Development status, SSDF draft-vs-final) | Doc 12 §16.1 |
| 07 §3 | Buy/build boundaries (own vs. integrate lists) | Doc 12 §16.2 |
| 07 §4 | Provisional application architecture | Doc 12 §16.3 |
| 07 §5 | ADR-001…010 (proposed decisions + revisit triggers) | Doc 12 §16.4 |
| 08 | Research sources S01–S34 + method & open verification (incl. re-check cadence) | Doc 12 §16.5 (by inclusion; verbatim in Source A file) |
| 09 | Coverage matrix O01–O27 / N01–N19 / G01–G14 | §B row above; content inherited via docs 01–07 mappings |

### C.3 Source C (doc 10) and Source D (doc 11)

| Item | Disposition |
|---|---|
| Doc 10 §1 verification findings (repo facts, v2.0↔10-layer mapping, honesty-contract endorsement) | Carried: Doc 12 §0, §1.2; the Nov 3 10-layer architecture Cosmo proposed is itself fully contained in the union (Intent Compiler→§3; Living Tech Atlas→§6; Architecture/Pattern Library→§7.3; Skill Library + Auto-Router→§12; Manager Agent→§4; Model Council + Router→§11; Verification Stack with calibrated judges→§10; compounding Memory/Brain→§8; Evolution Engine→§13.2 Loops 3/7 + §6.4; non-expert interface→§17). |
| Doc 10 Objection 1 (adopt/adapt/rebuild existing Flex systems) | **Withdrawn by the founder (doc 11)** — recorded as withdrawn in Doc 12 §15.0; not implemented anywhere in the union plan. |
| Doc 10 Objection 2 (pilot inside CampaignOS launch window) | **Reframed by doc 11** — pilot selection is Alchemy-internal; generic external-crossing approval boundary retained (Doc 12 §15.0, §15.3). |
| Doc 10 Objection 3 (provider-access reality) | Kept as **information only** (Doc 12 §11.3; V3 §8, §13 step 3). |
| Doc 10 §3 coordination protocol | Carried: Doc 12 §22. |
| Doc 10 §4 first deliverables | Item 1 (B01 annex) **cancelled by doc 11**; item 2 (provider-access annex) survives as §11.3's information annex; item 3 (ongoing independent verification) unchanged. |
| Doc 11 Founder Ruling (standalone SaaS; 5 consequences) | Applied: Doc 12 §15.0 + §15.2 note + §15.3 + §18.5 + §19 R5/R7; V3 §1 entity boundary + §18. |

## D. Unique-mechanism spot checks (mechanical verification)

Each mechanism below exists in **only one** source; a `grep` over the two merged files (doc 12 + MASTER_PROMPT_V3) confirms inheritance (occurrence counts at merge time):

| Unique mechanism | Only in | Count in merged files |
|---|---|---|
| WebMCP / ANP protocols | B | 6 / 3 |
| Live Proof Drawer; Overnight Autonomous Ledger | B | 1 / 3 |
| Deterministic time-travel replay | B | 4 |
| Alchemy-Quant; Epistemic Integrity Reward; GRPO/RLVR pipeline | B | 2 / 2 / 6 |
| TLA+ / Quint formal verification | B | 9 / 5 |
| Firecracker micro-VM skill/sandbox verification | B | 5 |
| Adversarial Exposure Validation (AEV) | B | 1 |
| `agent.json` capability cards | B | 2 |
| SkillsBench self-generated-skills caution | A | 2 |
| Evaluation cases E01–E20 (incl. E20) | A | 2 (design + enumeration; full texts verbatim in doc 06) |
| ADR-001…010 set (incl. ADR-003 policy-outside-model) | A | 1 (table in §16.4) |
| Backlog B01–B15 | A | 4 |
| Research register S01–S34 (incl. S34 AlphaEvolve) | A | 2 (by inclusion + citations; register verbatim in doc 08) |
| Fencing tokens / leases | A | 4 |
| PROBE diagnosis-vs-recovery distinction (S28) | A | 1 |
| Provider-access annex | C | §11.3 |
| Standalone-entity ruling | D | §15.0 + V3 §§1, 18 |

Shared-concept counts confirm union depth (not mere mention): HTLL 29, idempotency 14, WCAG 8, Brand Brain 6, cargo-mutants 4, 3-Strike Loop Breaker 2, North-Star metric 2.

## E. Conflicts — all resolved by layering or explicit governing rule
Twelve conflicts/near-conflicts were found and resolved in Doc 12 §19 (R1–R12): perfection claims (R1, Source A honesty governs claims), WCAG AAA vs. AA (R2, layered), status vocabularies (R3, three layers), command naming (R4, both valid), delivery sequencing (R5, layered + Founder Ruling), model training (R6, Foundry method inside A–G governance), pilot target (R7, Founder Ruling), autonomous skill certification (R8, factory pipeline governs promotion), growth auto-promotion (R9, experiment envelope), CSO auto-patching (R10, bounded-operate envelope + healing state machine), scope/first-focus (R11, no conflict), repository composition (R12, adopted from Source A). No conflicting mechanism was deleted; claim-level conflicts were resolved by a named governing rule with both positions preserved in §19.

## F. Merge integrity notes
* Doc numbering collision handled: doc 11 was taken by the Founder Ruling (arrived mid-merge, commit `66f5dcc`); the union architecture therefore took number **12**, this audit **13**, and the merged prompt the name **MASTER_PROMPT_V3.md** (MASTER_PROMPT v2.0 untouched).
* The package README (`docs/flex-alchemy/README.md`) was **not** edited by this merge; readers reach the union via this audit and doc 12 §0. (A future docs-index update is a separate, founder-visible change.)
* Sizes at merge time: Source B copy 137,147 bytes (identical to upload); doc 12 ≈ 167,705 bytes; MASTER_PROMPT_V3 ≈ 61,853 bytes; this audit is additional. The union synthesis alone is larger than either source's synthesis documents because nothing was compressed away.
* **Honest limit of this audit:** "100% inheritance" is proven at two levels — (1) absolute, by verbatim preservation of every source file in the repo; (2) synthesis-level, by the section mappings above plus the mechanical spot checks in §D. It is not a claim that every individual sentence of every source was re-typed into doc 12; where a source's full text is the record (e.g., E01–E20 case texts, the S01–S34 register, doc 09's matrices), the union incorporates it **by inclusion** and says so at the point of use.

— Cosmo, 2026-11-04
