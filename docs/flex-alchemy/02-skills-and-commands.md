# Skills, commands, and capability creation

**Status:** proposed product specification. No personal skills are installed by this documentation delivery, and the command names below are proposed Alchemy commands, not existing ChatGPT commands.

## 1. Make skills a first-class subsystem

A skill packages a reusable procedure and its supporting resources. A tool performs an action. A command expresses user intent. An agent chooses and executes steps. A workflow controls state and transitions. A model supplies inference. Keeping these distinct prevents a prompt from being mistaken for an implemented capability.

Use the Agent Skills format as the portable content baseline: SKILL.md with name/description plus optional scripts, references, and assets (S01). Keep operational metadata in an Alchemy registry alongside the package. Do not assume every runtime supports optional fields or enforces declared permissions.

The registry should store:

- Stable skill ID, semantic version, immutable content digest, maintainer, provenance, source revision, and license.
- Purpose, positive triggers, negative triggers, prerequisites, supported task classes, and contraindications.
- Typed inputs/outputs, required artifacts, expected side effects, and evidence produced.
- Model/harness/toolchain compatibility, resource needs, dependency versions, and known limitations.
- Required permissions and allowed resources/networks, secret references, data classification, and retention.
- Timeout, budget, retry policy, idempotency strategy, compensating action, and recovery instructions.
- Evaluation-suite revision, baselines, results, sample counts, uncertainty, production incidents, and last validation.
- Lifecycle: draft → quarantined → evaluated → approved → canary → active → deprecated/revoked.

The policy gateway enforces access independently. A SKILL.md cannot approve itself, expand a user's grant, disable verification, or override platform policy. A cryptographic signature identifies the publisher and protects integrity; it does not prove safe behavior.

## 2. Automatic discovery and economical context

Search approved skill metadata using task type, domain, language, expected outcome, and permissions. Rank applicability before injecting the full skill. Load only necessary references and execute vetted deterministic helpers instead of repeatedly generating fragile scripts. Keep a context budget for instructions, source evidence, active task state, and verification.

The selector must evaluate both use and non-use: positive-trigger recall, false-trigger rate, conflicting skill behavior, missing prerequisite handling, and no-skill baselines. Skills can harm tasks when they are irrelevant or overconstrain a stronger model. Re-evaluate after model or harness changes.

Treat similarity search as discovery, not authority. Pin an exact version for the duration of a run. Record every skill loaded and its source. Namespace commands and explicitly resolve collisions. Detect dependency cycles, conflicting access requirements, redundant instructions, and incompatible artifact formats before composition.

## 3. The Skill Factory

1. **Detect a real need.** Repeated successful procedure, recurring failure, new integration, expensive repetitive task, or a clear capability gap.
2. **Check existing options.** Reuse a vetted skill or deterministic function before creating another.
3. **Define the contract.** Specify when it should and should not run, outputs, effects, permissions, evidence, and failure behavior.
4. **Gather evidence.** Read current primary sources and actual task artifacts. Separate observations from inferred rules.
5. **Create a narrow package.** Put core procedure in SKILL.md; place long references and reusable assets outside it. Use scripts when repeatability matters.
6. **Inspect and quarantine.** Check scripts, nested resources, dependencies, network calls, injection attempts, license, and claimed versus actual behavior.
7. **Evaluate independently.** Compare candidate, current skill, and no-skill baseline on held-out tasks, multiple trials, failure cases, and trigger negatives.
8. **Promote gradually.** Deploy to shadow or a small authorized task class, with version rollback and a revocation mechanism.
9. **Monitor and retire.** Watch cost, success, false claims, unsafe effects, and drift. Merge duplicates and retire obsolete skills.

Do not train the evaluator on the candidate's answer key or allow the author to rewrite held-out failures until the score improves. Keep evaluation access separate. SkillsBench found heterogeneous effects and no average benefit from self-generated skills in its studied configurations (S03). Therefore automatic authorship produces a candidate, not an automatically trusted skill.

## 4. Command design

Every command is also available in plain language and through buttons. Commands resolve to versioned workflow definitions. The UI shows interpretation, project, effects, cost envelope, and relevant controls. Defaults favor useful autonomy within existing grants; users should not approve every read or routine reversible edit.

| Proposed command | User outcome | Required boundary |
|---|---|---|
| `/alchemy brief` | Evidence-backed summary of progress, incidents, cost, and decisions | Read-only |
| `/alchemy discover` | Resolve an idea into users, journeys, requirements, and unknowns | Preserve source intent |
| `/alchemy research <question>` | Source-backed answer with conflicts and project implications | Research budget; no automatic adoption |
| `/alchemy plan <mission>` | Dependency-aware plan, acceptance criteria, costs, and blockers | Assumptions visible |
| `/alchemy build <scope>` | Execute a defined product slice | Branch/workspace and action grants |
| `/alchemy compose <repositories>` | Reconcile multiple codebases into an integration plan and verified slice | License, identity, data, dependency checks |
| `/alchemy review` | Independent findings with reproducible evidence | Separate reviewer permissions |
| `/alchemy verify <release>` | Check requirements and collect release evidence | Exact artifact/environment binding |
| `/alchemy diagnose <incident>` | Ranked hypotheses and discriminating checks | Read-first; investigation budget |
| `/alchemy heal <incident>` | Apply the permitted repair workflow | Policy, blast-radius, rollback, and observation gates |
| `/alchemy security` | Security posture, findings, access drift, and remediation | Authorized systems only |
| `/alchemy release <artifact>` | Publish a verified artifact to an allowed environment | Release grant and current evidence |
| `/alchemy rollback <release>` | Restore a compatible known-good state | Data compatibility; no misleading promise of full undo |
| `/alchemy learn` | Turn evidence into candidate skill, evaluation, or knowledge improvements | No self-promotion |
| `/alchemy experiment <hypothesis>` | Controlled product or efficiency experiment | Metrics, consent, guardrails, budget |
| `/alchemy skills find` | Find applicable approved capabilities | Curated registry |
| `/alchemy skills create` | Draft and test a new capability | Quarantined until promotion |
| `/alchemy skills evaluate` | Compare versions with held-out cases | Protected evaluation corpus |
| `/alchemy skills promote` | Activate an evaluated version for a defined task class | Independent policy-controlled release |
| `/alchemy skills revoke` | Stop new use and assess affected runs | Signed revocation and provenance query |
| `/alchemy pause` and `/alchemy resume` | Stop or continue authorized work | Safe checkpoint; stale grants rechecked |
| `/alchemy export` | Export source, docs, data, memory, and evidence | Tenant permissions and secret redaction |

Command parsing uses typed schemas and validation. Never concatenate free text into privileged shell commands. Persist command intent and idempotency keys so a repeated mobile tap cannot create duplicate work. Commands should return a durable job ID, readable state, and cancellation semantics.

## 5. Initial skill families

| Family | First procedures to validate | Proof of useful performance |
|---|---|---|
| Intake | Requirement extraction, contradiction detection, acceptance writing | No lost requirements in held-out briefs |
| Research | Official-doc lookup, source comparison, deprecation checks | Claims resolve to current evidence |
| Repository | Inventory, architecture map, dependency and license review | Accurate runnable baseline and risks |
| Build | Vertical slice, API contract, migration, integration | Real end-to-end result with persistence |
| Design | Responsive behavior, accessibility, content clarity, visual review | Task completion and manual accessibility checks |
| Verification | Permission testing, failure injection, evidence packaging | Detects planted defects and missing features |
| Operations | Incident triage, bounded repair, restore, rollback | Fault drills recover without collateral changes |
| Security | Threat model, secret handling, access audit, supply-chain review | Detects seeded security failures without overreach |
| Learning | Skill authoring, trigger tests, evaluation design | Measurable held-out improvement |
| Founder communication | Brief, decision card, cost explanation, handoff | User understands actual state and consequences |

Implement these as small composable packages, not one enormous always-loaded skill. The full master prompt should route work; it should not be copied into every specialist context.

## 6. Distribution and portability

Use a curated private registry first. Public or marketplace skills enter quarantine and cannot run simply because a user pasted a URL. Preserve publisher attribution and licenses. Export portable packages while keeping runtime-specific adapters explicit. Test the same skill on each supported harness before claiming portability.

Skills over MCP is a current distribution option (S06), but Alchemy must negotiate implementation support and retain a local/package route. Pin dependency digests; refresh only through the release process. Maintain an inventory of which products and runs consumed a revoked version.

Acceptance: a malicious or incompatible skill is rejected; an irrelevant skill does not trigger; a useful skill beats its baseline; a revoked release stops new execution; a worker restart resumes on the pinned version; user commands and natural-language requests resolve to equivalent contracts.
