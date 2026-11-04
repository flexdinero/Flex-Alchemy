# Research sources and freshness register

**Checked:** November 4, 2026. Sources below are official specifications, original vendor documentation, original repositories, or research authors' publications. Research findings are specific to their datasets and configurations; they are not measured Alchemy performance. Recommendations elsewhere are original system-design proposals, not claims that these sources prescribe the complete architecture.

## Skills, protocols, and evaluation

| ID | Primary source | Observed finding and limitation |
|---|---|---|
| S01 | [Agent Skills specification](https://agentskills.io/specification) | Skills package instructions and optional resources around SKILL.md. The allowed-tools field is experimental; a manifest alone is not a portable enforcement boundary. |
| S02 | [Anthropic skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) | Authoring includes testing, feedback, benchmarking, and trigger-description improvement. A skill's existence is not evidence of benefit. |
| S03 | [SkillsBench paper](https://arxiv.org/abs/2602.12670) and [authors' release explanation](https://www.skillsbench.ai/blogs/introducing-skillsbench) | Paper abstract reports average benefit from curated skills and no average benefit from self-generated skills. Effects vary, including regressions. Paper snapshot and later registry counts differ; do not mix them. Abstract and release explanation reviewed, not an independent reproduction. |
| S04 | [Microsoft Agent Skills security guidance](https://learn.microsoft.com/en-us/agent-framework/agents/skills) | Treat skills as third-party code and instructions requiring review and sandboxing. |
| S05 | [MCP current specification](https://modelcontextprotocol.io/specification/2026-07-28) | The latest-spec URL resolved to 2026-07-28. MCP connects tools and context; extensions require compatible implementations. Verify client/server support, not just specification availability. |
| S06 | [Skills Over MCP working group](https://modelcontextprotocol.io/community/working-groups/skills-over-mcp) | The charter identifies the published Skills extension and ongoing interoperability work. Distribution compatibility remains an implementation question. |
| S07 | [A2A specification](https://a2a-protocol.org/latest/specification/) | Lists released version 1.0.0; defines task/artifact exchange and caller-scoped access. It does not supply a complete authorization policy or guarantee agent competence. |
| S08 | [Anthropic: Demystifying evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents) | Evaluate the model together with its harness and final environment state. Use repeat trials and appropriate deterministic, model, and human graders. |
| S09 | [SWE-EVO](https://arxiv.org/abs/2512.18470) | Long-horizon evolution benchmark highlights difficulties beyond isolated issue repair. Historical model results must not be presented as current model rankings. Abstract reviewed. |
| S10 | [SWE Atlas](https://labs.scale.com/papers/sweatlas) | Evaluation includes codebase Q&A, test writing, and refactoring, extending beyond bug fixes. Benchmark results do not certify production readiness. |

## Runtimes and current provider changes

| ID | Primary source | Observed finding and limitation |
|---|---|---|
| S11 | [OpenAI Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview) | Managed Codex harness provides sessions, context management, tools, and recovery. Actual account eligibility, resource limits, and workload cost require validation. |
| S12 | [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations) | Evals platform became read-only October 31, 2026 and is scheduled for shutdown November 30; Agent Builder and reusable prompt objects also have November 30 shutdown schedules. Self-serve fine-tuning access is restricted and new-job availability for remaining active customers is scheduled to end January 6, 2027. These are published schedules, not independent service tests. |
| S13 | [Anthropic managed-agent architecture](https://www.anthropic.com/research/managed-agents) | Separates sessions, harnesses, and execution environments so implementations can change. Availability and fit require testing. |
| S14 | [Anthropic long-running harnesses](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents) | Persistent artifacts and incremental progress address context discontinuity. The article does not prove general autonomous project completion. |
| S15 | [Google ADK 2.0](https://adk.dev/2.0/) | Documents graph workflow changes and compatibility considerations. Lists Python, Go, and TypeScript 2.0 availability; language feature parity must still be checked. |
| S16 | [Google ADK evaluations](https://github.com/google/adk-docs/blob/main/docs/evaluate/index.md) and [safety](https://github.com/google/adk-docs/blob/main/docs/safety/index.md) | Provides evaluation and safety mechanisms. Available criteria and cloud dependencies vary; framework defaults do not establish application security. |
| S17 | [LangGraph interrupts](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/interrupts.mdx) and [persistence](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/checkpointers.mdx) | Checkpointed execution can pause for input and resume; persistence durability is configurable. A checkpointer does not make external effects exactly-once. |
| S18 | [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview) | Documentation describes the successor to AutoGen and Semantic Kernel, with agent, harness, workflow, and integration layers. Language implementations differ. |
| S19 | [Temporal durable AI](https://docs.temporal.io/ai) and [workflow definitions](https://docs.temporal.io/workflow-definition) | Durable workflows support recovery and long waits; deterministic workflow logic and versioning remain engineering requirements. |
| S20 | [OpenHands repository](https://github.com/OpenHands/OpenHands) | Current repository separates Canvas frontend, SDK/server, TypeScript client, and automation ownership. Inspect the correct repository before reusing implementation. |
| S21 | [LangChain OSS overview](https://www.langchain.com/oss-overview) | Distinguishes Deep Agents harness, LangChain agent abstractions, and LangGraph workflow runtime. Avoid treating these as three independent orchestrators to stack indiscriminately. |

## Security, reliability, and assurance

| ID | Primary source | Observed finding and limitation |
|---|---|---|
| S22 | [OWASP Agentic Top 10 for 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) | Agent-specific security risk framework; use as a threat-model input, not a certification. |
| S23 | [NIST SSDF publications](https://csrc.nist.gov/projects/ssdf/publications) | Lists SSDF 1.1 as final, 1.2 as draft, and the generative-AI profile SP 800-218A as final. Do not describe a draft as an adopted final standard. |
| S24 | [SLSA provenance](https://slsa.dev/spec/v1.2/provenance) | Provenance supports tracing artifacts to sources and build processes. Signatures/provenance establish origin and integrity, not semantic correctness. |
| S25 | [OpenTelemetry agent conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md) | Includes agent/workflow/tool and skill-related spans; document status is Development. Pin schema versions behind an adapter. |
| S26 | [Google SRE error-budget policy](https://sre.google/workbook/error-budget-policy/) and [canary releases](https://sre.google/workbook/canarying-releases/) | Reliability budgets and staged release decisions connect operational signals to change policy. Numerical examples are not automatically Alchemy targets. |
| S27 | [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) | Accessibility requirements extend across devices and include testable criteria. Automated scans alone do not establish conformance. |
| S28 | [Microsoft Research: PROBE](https://www.microsoft.com/en-us/research/publication/debugging-the-debuggers-failure-anchored-structured-recovery-for-software-engineering-agents/) | Structured telemetry, diagnosis, and bounded guidance improve recovery in studied tasks, but recovery remains incomplete. Publication abstract reviewed. |
| S29 | [MemSecBench](https://arxiv.org/abs/2607.27080) | Studies memory poisoning through persistence, execution, and repair. Abstract reviewed; no independent reproduction or universal attack-rate claim. |
| S30 | [Scanning the Harness](https://arxiv.org/abs/2609.07360) | Studies supply-chain defects in agent configuration artifacts. Highlights harness configuration as an attack surface. Abstract reviewed; no independent replication. |

## Training and research-driven improvement

| ID | Primary source | Observed finding and limitation |
|---|---|---|
| S31 | [Hugging Face TRL](https://huggingface.co/docs/trl/quickstart) and [CLI](https://huggingface.co/docs/trl/clis) | Provides SFT, preference/reward methods, and distillation tooling. Tool availability does not establish data rights, training economics, or model suitability. |
| S32 | [Nature: recursive-data model collapse](https://www.nature.com/articles/s41586-024-07566-y) | Demonstrates degradation in studied recursive training conditions. It does not imply all synthetic training data are harmful. |
| S33 | [Systematic Knowledge Injection](https://arxiv.org/abs/2502.08356) | Investigates domain retrieval and fine-tuning interactions, including general-capability retention. Abstract reviewed; not evidence that fine-tuning replaces retrieval. |
| S34 | [Google DeepMind AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) | Combines program proposals and automated evaluators in measurable optimization settings. This is a useful design pattern, not proof of universal recursive self-improvement. |

## Research method and open verification

The sweep covered skills, protocols, agent runtimes, durable orchestration, evaluations, supply-chain security, memory, recovery, observability, accessibility, operational reliability, and model post-training. Official documentation was preferred over aggregator articles. GitHub was used to resolve the user's repository and inspect its current contents; public upstream repositories were also reviewed through primary-source pages.

This is not a package-by-package vulnerability scan, architecture benchmark, training experiment, cost quote, legal opinion, or exhaustive literature review. No framework was installed or benchmarked. No claims of performance superiority are made. Social feeds and popularity were not treated as technical evidence.

Implementation must re-check exact dependency releases, advisories, pricing, licenses, limits, regions, data policies, and account access. Re-check vendor changes immediately before procurement and deployment. Read full papers and inspect experimental methods before basing an expensive implementation decision on an abstract. Track retractions, corrections, source conflicts, and failed replications.

Suggested future cadence, not an active automation: security/deprecation signals daily; selected dependency compatibility weekly; skill/model regression evaluation on change; architecture review monthly or when evidence warrants it. A new publication creates a candidate investigation, never an automatic production upgrade.
