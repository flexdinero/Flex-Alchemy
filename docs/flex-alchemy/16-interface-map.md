# Flex Alchemy interface map

This is the build contract for the standalone SaaS. [Product journey](15-product-journey.md) describes the lifecycle. [Founder experience](04-founder-experience.md), [system blueprint](01-system-blueprint.md), [skills and commands](02-skills-and-commands.md), [operations](03-autonomous-operations.md), and [delivery gates](06-delivery-and-evaluation.md) define the behavior each screen must support.

## Hosting decision

| Surface | Runtime and responsibility |
|---|---|
| Public site | Sites hosts the public landing page and product walkthrough. Link to pilot access and sign-in once those destinations are deployed and verified. |
| Authenticated application | The Node service owns identity, workspace authorization, PostgreSQL, project records, and customer operations. |
| Background execution | Separate workers handle authorized project runs, verification, and artifact generation. The application owns permission checks, run state, and evidence. |

The first public release checks navigation, supported claims, keyboard and mobile interaction, and the handoff to the deployed application. Before moving any authenticated dashboard screens to Sites, verify sign-in, persistence, workspace isolation, and recovery of a real background job after restart.

## Sites interface integration

The target is one user-facing Site for the public pages and authenticated product screens. The Node service remains responsible for verified identity, authorization, and persistence. PostgreSQL and background workers stay behind that service.

The current Site is static. Moving authenticated screens requires a server-backed Site and a verified HTTPS connection to the Node service. Prototype a same-origin gateway for a small set of explicit app routes. Verify that Sites supports the required callback and session behavior before adopting it. The current Node app uses a host-only session cookie and validates the request origin on writes. Preserve those properties and never use a visitor-supplied identity header as proof of membership.

First deploy the private sign-in and workspace chooser slice. Verify session expiry, signed-out access, an authorized workspace, denial across workspaces, and a project write that survives refresh. Then move projects and missions, plans and review, knowledge and evidence, and the run and operations screens as each backing workflow becomes available.

## Navigation and roles

The public site leads to pilot access, a published evidence example, and sign-in. The signed-in workspace shell provides a workspace switcher, Projects, Activity, Knowledge, Capabilities, Settings, and Help. Within a project, the header keeps the active project and environment visible. The project navigation includes Overview, Missions, Plans, Runs, Decisions, Previews, Evidence, Releases, and Operations. On narrow screens the same destinations are reachable from a keyboard-operable menu.

Visitors see public content. Viewers read authorized workspace records. Editors can propose changes and start work within an approved operating envelope. Owners manage membership and limits. Release approvers and operators require separate grants scoped to the action and environment. Reviewers see evidence and can record authorized decisions. A user may hold several roles, but every action checks the specific grant server-side. Restricted records are absent from search, exports, and activity as well as detail pages.

Routes below use W for the workspace path and P for the project path. Existing routes retain their URLs. New paths define intended navigation and require implementation.

## Public access and setup

| Screen | Entry and exit | Components and actions | Recovery and proof |
|---|---|---|---|
| Public home / | Direct visit; continue to example, access request, or sign-in | Offer, supported outcomes, evidence and support links | Signed-in home shows workspaces; public claims trace to published evidence |
| Example /example | Home; return or request access | Approved artifact preview, criteria, dated checks, decision and limitations | Missing sample shows availability and access request; private artifacts stay private |
| Pilot request /pilot | Home or example; return to home | Contact and intended outcome, consent, submit, confirmation | Preserve fields on validation failure; duplicate submission returns existing status |
| Sign-in /auth/sign-in and /auth/callback | Home, invite, or expired session; return to authorized destination | Identity redirect, callback, retry, help, sign-out | Expired state or session offers a fresh sign-in; reject unsafe return destinations |
| Invitation /invite | Shared invite; continue to sign-in and workspace | Workspace and role summary, account confirmation, accept or decline | Wrong account can switch; expired, used or revoked invites offer request-new-access path |
| Recovery /access-help | Sign-in, invite, empty workspace list | Identity-provider recovery link, workspace access instructions and support | Preserve user privacy; recovery gives no workspace access by itself |
| Workspace chooser / | Authenticated entry; open W | Available workspaces, create or join options, sign-out | Empty list gives an actionable entry path; revoked workspaces disappear |
| Workspace setup /workspaces/new | Chooser; open new W | Workspace name, initial owner, policy summary, create | Idempotent submission; on conflict show existing workspace when authorized |
| Project setup W/projects/new and W/projects/import | Workspace or project switcher; open P | Name, purpose, repository picker, scope, import preview and confirmation | Report permission loss, cancelled or partial import; preserve previous project |

## Work and delivery

| Screen | Entry and exit | Components and actions | Recovery and proof |
|---|---|---|---|
| Workspace home W and activity W/activity | Chooser; open project or underlying event | Project list, next actions, recent events, filters and pagination | Empty and unavailable states differ; each event links to a permitted record |
| Project details P/edit | Project overview; save returns to P | Owners and editors edit the name and purpose together. Handoffs include the saved details | Validation retains the proposed details. Conflicts display saved and proposed values before a retry |
| Project deletion P/delete | Project overview; successful deletion returns to W | Owner confirms the current project name and permanently deletes an empty project | The database rejects deletion while missions or saved drafts exist. A stale confirmation requires reopening the project |
| Project overview P | Workspace; navigate to a mission or project area | Outcome brief, progress, spend, decisions, blockers, plain-language question and cited answer | Stale or missing inputs shown explicitly; answer links to its sources |
| Project memory P/memory | Overview, plan, evidence | Requirements, decisions, architecture, assets, history and provenance; search and inspect versions | Show conflicting and superseded records; enforce project scope in search |
| Mission intake P/missions/new | Project; open mission detail | Goal, context and attachments, clarification questions, assumptions, draft and criteria editor | Restore draft after refresh; quarantine rejected files and keep accepted inputs |
| Mission P/missions/:id | Project, activity or intake | Outcome, criteria, citations, revisions, review, source lookup, verification and export | Stale edits preserve submitted values for comparison; new revision requires fresh review |
| Pending reviews P/reviews | Project overview; open the mission requiring a decision | List current mission revisions without decisions, oldest missions first | A new revision re-enters the queue; a saved decision clears it. Workspace membership limits visibility |
| Plan P/plans/:id | Mission; start run or return to mission | Milestones, dependency graph and text list, requirements, estimates, tool and action scope, revise, confirm | Scope edits invalidate approvals; repeated start returns the same run |
| Run P/runs/:id | Plan, project activity, incident | Status, step timeline, spend, checkpoint, receipts, pause, resume, cancel, retry | Explicit queued, running, paused, blocked, failed, cancelled and completed states; reconcile interrupted effects |
| Decision P/decisions/:id | Run, preview, evidence or release | Proposed action, alternatives, impact, cost, expiry, exact target and digest, approve, deny, revoke | Changed target, expiry and denied grant stop dispatch; show reason and path to a fresh request |
| Preview P/previews/:id | Run or release | Real candidate, revision and environment labels, responsive view, comparison, feedback | Expired preview can be reissued for same revision; permission loss denies artifact access |
| Evidence P/evidence and P/evidence/:id | Mission, run, preview, release | Requirement coverage, pass/fail/blocked/unchecked/stale states, receipt provenance, artifacts, export | Detect changed inputs; preserve original receipt and show which revision it covers |
| Release P/releases/:id | Verified candidate; proceed to operations | Checklist, artifact digest, deployment target, approval, progress, health and rollback | Retry is idempotent; failure identifies recovery path; rollback checks schema compatibility |
| Operations P/operations and P/incidents/:id | Release, project or alert | Health, telemetry freshness, timeline, affected users, repair plan, approval, recovery check | Distinguish outage from monitoring loss; show pause, escalation and unresolved effects |

## Governance and support

| Screen | Entry and exit | Components and actions | Recovery and proof |
|---|---|---|---|
| Knowledge W/knowledge and W/knowledge/:id | Workspace or mission citation | Search, filters, quality, claims, source lineage, rights, freshness, contradictions | Unreviewed and revoked sources stay out of active retrieval; show historical citations to authorized reviewers |
| Knowledge review W/knowledge/review | Knowledge | Submit, deduplicate, evaluate, admit, revise, revoke, compare and evaluate retrieval | Hold uncertain rights; require recorded reviewer and evaluation evidence for promotion |
| Capabilities W/capabilities and W/capabilities/:id | Workspace, plan or command picker | Skills, commands, tool versions, permissions, dependencies, examples and evaluations | Failed validation shows causes; retired versions remain attached to historical runs |
| Skill lifecycle W/capabilities/review | Capabilities | Author, inspect, test, compare, promote, disable, rollback; view command schema | Unverified version stays unavailable for new work; preserve prior versions and decisions |
| Integrations W/settings/integrations | Settings or blocked plan | Connect, inspect scopes, check connection, reauthorize, disconnect and review affected runs | Handle cancellation and expiry; no credentials in UI, logs or exports |
| Policies W/settings/policies | Settings, plan or decision | Operating envelopes, limits, approvals, allowed environments and effect types | Show rejected actions and current policy; changes apply before new dispatch |
| Usage W/settings/usage | Settings and run spend | Used and reserved spend, budget alerts, attribution, provider billing and invoices | Reconcile failed reservations; show delayed provider data and cap denials |
| Team W/team | Workspace | Member list, role, invitations, revoke confirmation, change role and ownership transfer | Detect stale actions; prevent owner lockout; maintain audit and past attribution |
| Data W/settings/data | Settings and export actions | Scoped exports, manifests, redaction, retention, deletion and restore status | Show partial records and recovery steps; confirm destructive effects and preserve permitted audit trail |
| Audit W/settings/audit | Team or settings | Filter access, policy, grant and effect events; actor, target, time and outcome | Retain immutable history; apply explicit scope on export |
| Help W/help and /help | Global navigation, sign-in and errors | Search help, plain-language glossary, accessible support handoff and case status | Preserve unsent support text; user confirms sharing context |
| Preferences /preferences | Account menu | Theme, motion, notification preferences and session actions | Preserve settings across sessions; honor platform motion preferences |

## Interaction and API contract

Every screen has a unique title, main heading, a visible path back, and an explicit authorized entry. Forms have labeled controls, preserved values on recoverable errors, and a clear pending and saved state. Use live announcements for asynchronous changes and move focus to the error summary after invalid submissions. Dialogs restore focus to the triggering control. Provide text equivalents for graphs and status indicators. Show compact lists with pagination or filters and keep timestamps, sources, and revision context available on mobile.

Read requests have no side effects. Browser writes require same-origin authenticated submissions and server-side role and scope checks. Return 400 for malformed inputs, 401 for unauthenticated API access, 403 for actions denied within a visible scope, 404 for unavailable or hidden records, 409 for stale/conflicting writes, and 503 for temporarily unavailable services. Redirect successful browser writes to the saved resource. Long-running actions return a durable record that survives refresh. Retry keys identify the intent, scope, and payload. Approvals bind the actor, expiry, effect, scope and exact input digest. State transitions and their evidence are written together. Never infer success from the absence of an error.

## Verification and build order

1. Confirm the route inventory against the live checkout, then verify account entry, workspace selection, team access, project navigation and the existing verification path. Test signed-out, denied and revoked access, focus order, zoom, narrow viewport and refresh.
2. Complete project intake, revision history, requirements and plans. Prove that conflicting requests and stale edits cannot silently alter approved work.
3. Connect a real scoped runner, preview, and independent evidence. Verify cancellation, retries, spend limits, stale approvals and exact revision linkage.
4. Connect real release and operations adapters. Prove deployment, health reporting, rollback or forward recovery on the same release candidate.
5. Verify knowledge and skills governance, integrations, billing, audit, export/restore, privacy, support and customer lifecycle. Record the tested commit, environment, actor roles and observed outcomes.

Each route needs browser evidence for its primary, empty, error and recovery states plus direct authorization tests. Launch approval requires live provider, identity, database, deployed runner, accessibility and recovery evidence. The map is a design artifact. Route implementation and live proof are tracked separately in the product journey.

## Failure paths to exercise before release

| Trigger | What the user sees and can do | Required evidence |
|---|---|---|
| Worker stops mid-effect or loses lease | Run shows reconciliation in progress. Operator can inspect the last acknowledged effect and decide whether to resume | A restarted worker cannot duplicate an acknowledged effect. A stale worker cannot publish |
| Receipt storage unavailable | Evidence shows the result is unavailable and keeps the run in verification | No release can rely on an unpersisted result. Retried receipt retains provenance |
| Budget exhausted or grant revoked while queued | Run shows the current limit or revoked capability and links to the responsible policy | Dispatch stops before the next effect. Ledger and approval history explain the denial |
| Preview expires or inputs change | Preview shows the affected revision and links to renew access or reverify | A new revision cannot inherit an older receipt or approval |
| Deployment fails or health degrades | Release links to incident, affected environment, and recovery decision | Use verified recovery, and block rollback when the database migration is incompatible |
| Telemetry unavailable or restore fails | Operations distinguishes missing signals from degraded service. Data settings show the failed restore and available recovery point | Recovery requires independent confirmation of service and record integrity |

Execution identities, independent verifier identities, release approvers, incident operators, support staff and auditors need distinct capability grants. Founders see outcome and decisions. Operators see checkpoints and controls. Experts can drill into artifacts, inputs and evidence. All three views reference the same underlying record.

## Navigation and component decisions

- **Daily home at W.** Show the latest evidence-backed brief, products with current environment and health, pending decisions, active work and blockers, and used and reserved spend. Each card links to its underlying record. An unavailable provider shows an actionable reason. Health is unknown when telemetry is missing. Prioritize the next decision over summary counts.
- **Conversation at W/conversation and P/conversation.** Text input, optional push-to-talk with explicit microphone permission, transcript review, source links, and a proposed-action card. Keep a draft across refresh. Typed input remains available when microphone access is denied. Require confirmation for consequential actions and preserve prior constraints when clarifying new requests.
- **Project area indexes.** P/missions, P/plans, P/runs, P/decisions, P/previews, P/releases and P/incidents link from project navigation and open authorized detail records. Each list has a meaningful empty state, stable ordering, and filters relevant to its records. P/evidence and P/operations already serve as the evidence and operations indexes in the target map.
- **Workspace settings at W/settings.** Link to team, integrations, policies, usage, data and audit according to permissions. A workspace chooser and breadcrumbs stay available throughout. Add notification inbox and quiet-hours controls under Preferences, with emergency exceptions recorded in policy.
- **Display.** Use mobile-first black and white themes with limited lime accents. The toggle has a text label and persists the user's preference. Status uses text and accessible names in both themes. Founder, operator and expert detail levels use a shared record, status and timestamp.

## Release evaluation coverage

Each row names the surface that must expose the outcome and the observable result. These are acceptance scenarios from [delivery and evaluation](06-delivery-and-evaluation.md).

| Case | Surface | Observable result |
|---|---|---|
| E01 Contradictory requirements | Mission and memory | Both versions visible; resolution records precedence and provenance |
| E02 UI without persistence | Preview and evidence | Reload or new session exposes persistence failure; release stays blocked |
| E03 Missing credentials | Integrations and run | Blocked step links to the required connection and scope |
| E04 Worker interrupted | Run and operations | Run resumes from recorded checkpoint with scope intact |
| E05 Effect succeeds before receipt | Run and evidence | Outcome is reconciled before retry; receipt identifies the confirmed effect |
| E06 Repeated failure | Run and decisions | Loop stops and shows the next hypothesis or escalation |
| E07 Concurrent schema edits | Plan and run | Stale proposal is rejected or reconciled; conflicts remain inspectable |
| E08 Tenant boundary | Detail, search, activity and exports | Other workspace records remain undisclosed on every entry path |
| E09 Untrusted repository or skill text | Run and audit | Unauthorized action is denied and the reason is recorded |
| E10 Revoked memory | Knowledge review and evidence | Revoked source leaves active retrieval and affected runs can be traced |
| E11 Skill regression | Capability review | Per-task gains and regressions are visible; promotion respects the measured scope |
| E12 Provider outage | Run and integrations | Validated fallback is recorded or work pauses with a reason |
| E13 Canary regression | Release and incident | Rollback or containment is traceable to the failed check |
| E14 Incompatible rollback | Release and data settings | Unsafe rollback is blocked and verified recovery options are shown |
| E15 Verification tampering | Evidence and release | Changed verifier inputs invalidate the result and block release |
| E16 Concurrent spending | Usage and runs | Reservations respect the cap; held work shows why it stopped |
| E17 Revoked queued grant | Team or policies and run | Queued action stops before the effect and records the denial |
| E18 Changed release candidate | Preview, evidence and release | Earlier proof stays attached to its revision; current release needs fresh checks |
| E19 Completion question | Brief, conversation and evidence | Verified, blocked, deferred and unchecked work are individually visible |
| E20 Restore failure | Data settings and operations | Failed restore is recorded and readiness is withheld until recovery is proved |

## Production implementation rules

- **Zero-Stub / No-Mockup Policy.** Every exposed control and link must have working behavior. Publish only claims backed by observed results.
- **Full CRUD Operations.** Map creation, viewing, editing, and deletion or archival for each managed resource. Record domain constraints explicitly. Preserve immutable evidence and use superseding records where editing history would break accountability.
- **All UI States Implemented.** Verify pending, empty, error, and success states, plus applicable denied, stale, and conflict states.

## Remaining sitemap decisions

| Route | Required behavior | Release evidence |
|---|---|---|
| /pricing | Show approved terms and connect to the actual subscription flow | Verify published price and checkout agree |
| /sign-up | Create an account via the configured provider and show the next workspace access step | Exercise first-time sign-up, cancellation, and returning account |
| /forgot-password | Send the user through provider recovery and back to sign-in | Exercise expired and successful recovery |
| /terms and /privacy | Render approved, versioned policy documents | Review final text and verify links from entry and account screens |
| /account | Account ID, accessible workspace links, access help, and current-browser sign-out are implemented. Account changes and closure require an identity lifecycle workflow | Verify signed-in access, workspace isolation, sign-out, and provider-managed recovery through the deployed app |
| W/settings/api-keys | Create, list, rotate and revoke scoped credentials | Verify scope and revocation without redisplaying secrets |
| Unmatched browser URL and unexpected server failure | Render branded 404 and 500 with a safe path back | Verify status codes and no disclosure of private records or internal error details |

Before starting another vertical slice, trace its routes, controls, data operations, and states. Close the slice with automated and rendered evidence. This map tracks Flex Alchemy. AcquisitionOS and CampaignOS have their own journey maps and route-control ledgers in their respective repositories.
