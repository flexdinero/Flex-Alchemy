# The final founder experience

**Status:** product specification; illustrative interactions below are not live results.

## 1. One place to direct the entire lifecycle

The founder should experience Alchemy as a persistent technical organization that understands their products, completes authorized work, explains decisions, and shows what actually works. The founder does not need to choose a programming language, supervise prompts, remember model names, or reconnect project context each day.

The default home is an interactive activity feed with chat and optional voice. Mobile-first black/white themes, a theme toggle, and limited lime accents match the Flex direction. Accessible labels, keyboard navigation, screen-reader support, clear focus, and readable contrast matter more than decorative dashboards. Status cannot rely on color alone. Target WCAG 2.2 AA and verify with both automation and manual review (S27).

## 2. First-time setup

1. Describe a goal or import an existing project/repository.
2. Confirm the intended users and business outcome in plain language.
3. Connect only the accounts needed for the first useful milestone through secure authorization; never paste secrets into a chat transcript.
4. Set a spending ceiling, acceptable downtime, data restrictions, and an autonomy profile using concrete examples.
5. Review the first milestone, what it will enable, how success will be demonstrated, and external dependencies.
6. Start work and receive a preview as soon as a usable slice exists.

Use defaults and recovered context to avoid a long technical questionnaire. An optional expert can inspect architecture and contracts, but the founder's path must remain understandable. Revise assumptions openly as discovery proceeds.

## 3. Daily home screen

| Area | What the founder sees | What powers it |
|---|---|---|
| Today's brief | What changed, what works, what failed, what matters next | Evidence-backed project summary |
| My products | Current release, operating health, users affected, active mission | Project and operational state |
| Decisions | Recommended action, alternative, cost, risk, consequence of waiting | Versioned decision and authorization records |
| Live preview | The actual current build and which environment it represents | Revision-bound preview |
| Work in progress | Current outcome, last meaningful progress, blocker, forecast range | Durable work graph |
| Trust and evidence | Verified journeys, unverified areas, last check, known issues | Evidence ledger |
| Budget | Used, reserved, estimated remaining, and uncertainty | Usage ledger and forecasts |
| Controls | Pause, resume, limit scope, change budget, export, request rollback | Authenticated control actions |

The system should clearly distinguish "no issues detected" from "not checked." Failed telemetry must not make a product look healthy. Progress should count verified outcomes and remaining dependencies, not invented percentage-complete estimates or lines of code.

## 4. A normal day

**Illustrative morning brief:** "Lead imports now preserve owner-contact verification history. The browser and database checks passed on the preview release. Live SMS remains blocked because the provider is not connected. Today's work is import failure recovery. You have one decision: whether to enable SMS now or release the verified lead workflow first."

The founder asks: "Show me what you actually finished."

Alchemy opens the real journey, the relevant requirement, and the recorded verification result. It explains the result in ordinary language and offers technical detail on demand.

The founder says: "Make importing leads easier on my phone. Keep working within the budget."

Alchemy interprets this as a scoped usability improvement, preserves the existing acceptance requirements, examines real friction, updates the interaction, verifies persistence and responsive behavior, and produces a reviewable preview. It does not require the founder to specify component libraries or API details.

Later, a known worker failure occurs. If the owner has already authorized that recovery class, Alchemy applies its bounded runbook, verifies recovery, and reports the outcome. If the problem threatens data integrity, it contains the impact and presents a concrete decision rather than improvising a destructive repair.

## 5. Decisions and approval design

A decision card includes: what will happen, why it is needed, the exact affected resource/environment, cost or exposure, preview/evidence, reversibility, recommendation, alternatives, expiration, and who may authorize it. Bind approval to the specific artifact/action digest; material changes invalidate it.

Avoid approval fatigue. Routine actions within standing grants proceed automatically. Interrupt for decisions that affect business intent, materially change cost/risk, require missing access, or exceed the established operating envelope. Batch related decisions and support quiet hours with an emergency policy.

The user can see and revoke standing grants. A denial becomes an explicit constraint; the system must not silently retry the same forbidden action through another tool or agent.

## 6. Three layers of detail

- **Founder view:** outcomes, implications, confidence, cost, and decisions.
- **Operator view:** incidents, runbooks, dependencies, queues, release gates, and recoveries.
- **Expert view:** code, schemas, migrations, traces, test artifacts, security findings, and architecture decisions.

All views derive from the same records. A friendly explanation cannot hide a failed check that is visible only in expert mode. Exported evidence should be readable by an independent developer or auditor.

## 7. The trust experience

Every substantial claim answers: what was done, what proves it, when it was checked, what remains uncertain, and what happens next. Confidence is tied to a task/environment, never a universal "100% safe" score.

When Alchemy cannot proceed, it explains the blocker and the minimum useful action. If qualified expertise is needed, it prepares a concise handoff containing the problem, artifacts, attempted checks, and unresolved decision so the founder is not left to diagnose it alone.

The founder keeps product direction and authority. Alchemy supplies execution and technical supervision within proven scope. The experience can be highly autonomous without requiring blind trust.

## 8. Acceptance tests for the experience

- A nontechnical test user can state a mission, understand the proposed first outcome, and find the preview without help.
- They can correctly distinguish implemented, verified, blocked, and released features.
- They can explain the consequences of a decision card before accepting it.
- A refresh, device switch, or interrupted session preserves project state and pending decisions.
- Pause and budget controls visibly take effect; queued work cannot bypass them.
- An integration that is disconnected, unauthorized, or failing is represented truthfully.
- A user can export the project and hand it to another development team.
- A mobile user can complete core actions, recover from errors, and inspect evidence accessibly.

Test with representative people, not only AI-generated personas. Simulated users are useful for breadth but cannot replace real usability feedback.
