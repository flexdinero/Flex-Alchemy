# Current technology decisions and buy/build boundaries

**As of November 4, 2026.** Candidate selection is provisional until an Alchemy-specific benchmark and account checks are completed. No runtime winner has been established by this research.

## 1. Current options

| Layer/candidate | Why evaluate it | What must be proven for Alchemy | Source |
|---|---|---|---|
| OpenAI Agents API | Managed execution harness and sessions | Account access, persistence/export, costs, isolation, tool controls, failure recovery | S11 |
| Anthropic managed agents / Agent SDK route | Long-running agent infrastructure and coding capabilities | Hosting/control tradeoffs, exportability, verification integration | S13–S14 |
| Google ADK 2.0 | Explicit graph workflows and Google ecosystem integration | Language-specific features, storage contracts, retries, integrations | S15–S16 |
| LangGraph / Deep Agents | Controllable graph state or higher-level harness | Persistence settings, replay/effect behavior, operational effort | S17, S21 |
| Microsoft Agent Framework | Enterprise integration and workflow/harness options | Language maturity, hosting, governance, migration requirements | S18 |
| OpenHands SDK/server | Open development execution components | Correct upstream repository, sandbox security, evidence and policy integration | S20 |
| Temporal | Durable multi-step business execution and recovery | Operational burden, replay/versioning, clean ownership of state | S19 |

These are not interchangeable categories. A managed harness, an agent SDK, a durable workflow engine, a communication protocol, and a model solve different problems. Do not stack multiple systems that all believe they own retries, scheduling, state, and approvals without an explicit boundary.

For the first pilot, evaluate one managed harness against one self-controlled harness on the same tasks. Add a separate durable workflow engine only when the selected runtime cannot adequately own long-lived business orchestration or cross-service recovery. If both are used, the outer engine owns the mission lifecycle and irreversible effects; the inner harness owns bounded reasoning/execution sessions. Document cancellation and retry ownership.

## 2. Updates that change earlier assumptions

- ADK's current documentation describes the 2.0 graph workflow architecture. Do not blindly copy old workflow-agent tutorials into a new system (S15).
- The MCP latest-spec endpoint resolves to the July 28, 2026 specification; A2A lists 1.0.0. Pin the negotiated implementation versions and test compatibility (S05, S07).
- Skills over MCP is now a published extension, but host/server support must be tested (S06).
- Microsoft documents Agent Framework as the successor to AutoGen and Semantic Kernel (S18).
- OpenAI's older Evals platform, Agent Builder, reusable prompt objects, and self-serve fine-tuning routes have published lifecycle changes. Keep prompts/evaluations portable and verify eligibility before committing to provider-specific features (S12).
- OpenTelemetry's relevant agent conventions are still marked Development. Use an internal stable event model with an export adapter (S25).
- NIST's publication list still distinguishes final SSDF 1.1 from draft 1.2. Draft status matters (S23).

## 3. Build what differentiates Alchemy

| Own/build | Integrate or buy where suitable |
|---|---|
| Founder intent and requirement traceability | Commodity identity and authorization components |
| Project Brain and evidence semantics | Durable execution infrastructure |
| Skill lifecycle and task-specific evaluations | Sandboxed compute and artifact storage |
| Autonomy policy and understandable decisions | Model inference and existing coding harnesses |
| Cross-repository composition contracts | Standard observability and security scanners |
| Recovery policies and product-specific runbooks | Managed databases, queues, and backups |
| Verified outcome learning and proprietary datasets | Provider SDKs and established integration protocols |

Buy/build decisions consider control, exportability, security, total cost, operational burden, and vendor exit—not novelty alone. Preserve boundaries that let a component be replaced without losing the product's history.

## 4. Provisional application architecture

Use a modular application control plane with a web interface, transactional database, object storage, and isolated execution workers. TypeScript is a reasonable candidate for the founder interface given the user's existing stack; Python is a candidate for research/training tasks where ecosystem fit warrants it. This is a proposed fit, not a mandatory universal stack.

Keep business state transactional; derive the feed from an event/outbox mechanism. Use stable schemas for mission, work item, action, evidence, and release. Verify concurrency and delivery semantics. Implement tenant-aware access checks at the service and data boundaries. Use a secret manager, audited service identities, and separately scoped worker environments.

Choose the actual frontend, database provider, workflow engine, harness, and hosting only after constraints and pilot results are recorded. The repository currently contains documentation, not a confirmed Next.js/Supabase/Temporal implementation. Do not create artificial dependencies on every attractive tool in this comparison.

## 5. Architecture decision records

| ADR | Proposed decision | Revisit trigger |
|---|---|---|
| 001 | Requirement/evidence state belongs to Alchemy, not a single model conversation | Proven managed alternative preserves control and export |
| 002 | Select one primary execution path for the pilot | Repeated capability or operational failure |
| 003 | Policy enforcement runs outside model-generated text | Never remove this boundary; improve its implementation |
| 004 | Verified skill registry precedes large-scale automatic skill creation | Real evaluation data supports expansion |
| 005 | Retrieval and skills precede proprietary weight training | Repeated gap with sufficient rights-cleared training data |
| 006 | Separate builder and protected verification for consequential work | Evidence shows a cheaper equivalent assurance method |
| 007 | Shared foundations retain product/tenant isolation | Measured need for stronger physical separation |
| 008 | Use standing grants and bounded autonomy | Incidents, changed risk, or new capability class |
| 009 | Improve in complete vertical slices | New dependency makes another slice more informative |
| 010 | Preserve portability of prompts, data, tests, and artifacts | Any provider contract threatening export or retention |

Every final ADR should record owner, date, alternatives, evidence, consequences, and the exact version/configuration selected. This table is an initial decision proposal, not an approval record.
