# Flex Alchemy product journey and release coverage

Alchemy helps a founder turn an outcome into authorized work, then judge it using evidence from the actual result. The primary path is describe → confirm → run → inspect → decide → release → observe. This map extends the [founder experience](04-founder-experience.md) and [delivery gates](06-delivery-and-evaluation.md). The [local workspace](../../apps/local/README.md) implements a bounded path through intake, source inspection, verification and saved evidence. The tables below describe the target journey. The hosted verification route is documented with its current scope.

| Surface and entry | User intent and actions | Components and required tools | Failure, recovery and acceptance |
|---|---|---|---|
| Public site and pilot access | Understand the offer, inspect a real example, request access | Evidence sample, scope and support details, invite workflow | Expired invitation leads to a recovery path. Published claims link to observed results |
| Sign-in and invitations | Accept an invite, sign in, recover access, sign out | Identity provider, session controls, membership service | Expired and revoked access is denied. Signed-out sessions cannot load artifacts |
| Workspace and project setup | Create or join a workspace, create or import a project | Workspace selector, role summary, repository picker, import preview | Show invalid, partial and cancelled imports. Verify authorization and preserve prior work |
| Mission intake | Describe an outcome in plain language, attach context, resolve ambiguities | Composer, upload review, requirement editor, source citations, acceptance checklist | Draft survives refresh. Changes preserve original intent and expose conflicting requirements |
| Project access and operating limits | Connect accounts, set spend and autonomy limits, review planned effects | Integration scopes, grant cards, budget controls, approval service | Missing, expired and revoked access shows next steps. Dispatch honors current limits |
| Activity and project home | See progress, ask what changed, find next action | Brief, chat, timeline, status labels, project switcher | Distinguish empty, disconnected and stale telemetry. Every status links to its source |
| Work plan | Review milestones and dependencies, start or revise work | Work graph, estimate and uncertainty, requirement traceability | Approval becomes stale when scope changes. Repeated starts create one run |
| Run detail | Inspect progress, blockers, attempts and spending. Pause, resume or cancel | Timeline, checkpoints, action receipts, scoped runner, durable queue | Recover interrupted work and reconcile effects. Verify that stale workers cannot publish |
| Decisions and approvals | Understand alternatives, consequences and cost. Approve, deny or revoke | Decision card, approver identity, expiration, exact action digest | Denial persists across retries. Changed artifacts require fresh approval |
| Preview | Use the actual candidate and compare revisions | Preview URL, environment and revision label, accessible feedback | Expired preview and unavailable runtime explain recovery. Verify revision matches evidence |
| Evidence | See what passed, failed, was blocked or remains unchecked | Requirement filter, verifier receipts, artifact viewer, export | Stale evidence is visibly invalid. Check provenance, access and revision before showing results |
| Releases | Approve a verified revision, monitor deployment, recover when needed | Release checklist, deployment adapter, health signals, rollback decision | Refuse stale or unauthorized release. Test rollback or forward recovery with a migration |
| Operations and incidents | Understand impact, review a proposed repair and confirm recovery | Incident timeline, alert routing, bounded runbook, independent recovery check | Surface telemetry loss. Stop unsafe repair and preserve rollback evidence |
| Knowledge | Search approved sources, see provenance, review admission and revocation | Search, source details, rights by use, quality and freshness controls | Keep conflicting records visible and exclude revoked material from active retrieval |
| Skills, tools and integrations | Find approved capabilities, inspect permissions and manage versions | Capability registry, connection checks, skill evaluations, secret references | Pin versions per run. Revoking access prevents new execution and flags affected work |
| Usage and billing | Review used and reserved spend, limits and invoices | Usage ledger, budget alerts, billing provider and invoice access | Provider errors stay visible. Concurrent reservations cannot exceed caps |
| Workspace administration | Manage people and roles, inspect access history, transfer ownership | Membership and audit views, role enforcement, owner transfer | Deny unauthorized role changes. Test invitation and revocation under actual roles |
| Export, retention and deletion | Hand work to another team or remove records | Authorized export with manifests, redaction, retention and deletion jobs | Report partial export or deletion. Verify restored data and records excluded by scope |
| Support and accessibility | Get help, report a blocker, adjust display and navigation | Help, support handoff, theme controls, keyboard and assistive technology support | Preserve accessible focus and actionable errors on mobile and desktop |

The founder, operator and expert views use the same records. Every page needs a valid entry route, keyboard access, visible focus, understandable status, empty and error states, and a route back to work. Test session expiration, duplicate submissions, stale updates, cross-tenant access and refresh on every applicable path. Use real users for comprehension checks and bind release evidence to the artifact tested.

## Current route inventory

The local server binds to loopback and serves one operator. This table inventories the local interface. The hosted entry below and the interface map describe the separate authenticated application.

| Route | Entry and controls | Evidence and recovery |
|---|---|---|
| GET / | Open the local workspace, prepare a standalone knowledge check, or open a saved run | Empty run list and invalid request feedback. Run detail links back here |
| GET and POST /projects | List projects and create one with a name and purpose | Invalid details return to the project list. Successful creation opens the project |
| GET /projects/:id | Read the project purpose, list its missions, and create a mission in that project | Missing projects return to the project list. The page shows an empty state before the first mission |
| GET and POST /missions | List missions and create one with a title, goal and acceptance criteria | Invalid details return to the list. Successful creation opens mission detail |
| GET /missions/:id | Read the current mission, open revision history, prepare a check and inspect previous reviews | Missing mission returns to the mission list. A revised mission awaits a fresh review |
| POST /missions/:id/revise | Save new criteria from the mission detail form | A stale revision returns a conflict with a link to reopen the mission |
| POST /missions/:id/review | Accept or request changes with an evidence note | Stale review submissions return a conflict. Prior decisions remain visible |
| POST /runs | Prepare a knowledge check, optionally tied to a mission revision | A stale mission form must be reopened. Successful preparation opens the run |
| GET /runs/:id and POST /runs/:id/verify | Inspect retrieved sources and run the verification check | Saved evidence is checked before display. A check covers knowledge navigation |
| GET /missions/:id/export | Download project name and purpose, mission criteria, revision and decision history, and linked run evidence | Evidence that cannot be validated is marked unavailable in a partial export |

Route-level HTTP checks cover core interactions. Rendered keyboard and assistive technology journeys, account entry and recovery, hosted workspace access, and deployment recovery still require release evidence.

## Hosted founder entry

The shared hosted header links to the workspace chooser and access help. Inside an accessible workspace it links to projects and activity, with Team access visible to owners. The current destination is marked for assistive technology.

After sign-in, users can open an accessible workspace, create one with themselves as its first Owner, or check their invitations under **Account**. The operator provisioning command is available for managed workspaces and refuses unknown identities and conflicting or revoked ownership.

Owners can open **Team access** to inspect memberships, revoke eligible access with confirmation, and invite existing Flex Alchemy accounts as Viewers or Editors. Recipients can accept or decline from the shared link or their account inbox. Pending invitations expire after seven days and owners can revoke them before use. Earlier work retains its attribution.

Account appearance supports Dark, Light, Match system, and a reset to Dark. The packaged app was exercised with local HTTPS, Keycloak, and PostgreSQL for sign-in, workspace and project creation, cross-workspace denial, reload, appearance persistence, keyboard navigation, and selected automated accessibility checks. Provider recovery and the complete journey still require verification on the deployed app.

## Hosted source catalog verification

From a hosted mission, open **Source catalog verification**. An owner or editor can run the structural check after accepting the mission. Workspace members can inspect the saved result, the review version, the actor and timestamp, and the SHA-256 digests of the catalog and checker. If the review changes before the result is saved, reopen the mission and read the new decision. Repeated submissions for the same review and inputs reuse the existing receipt. Recent workspace activity links to the evidence page. Mission, project, and workspace JSON handoffs carry the saved receipts. The check covers the deployed Alchemy catalog. General work plans, project artifact execution, releases, and rollback still require implementation.


## Delivery sequence

| System | Current evidence | Remaining capability |
|---|---|---|
| Intent and project memory | Local projects group missions. Mission revisions preserve prior goals and criteria. Hosted intake has a session-scoped API tested with embedded PostgreSQL | Hosted browser connection, individual requirement records, attachments and deployed access tests |
| Knowledge and skills | Source register, quality rules, deterministic lookup and one verification skill | Authorized ingestion, source rights review, broad retrieval evaluation and skill lifecycle |
| Director and execution | Local prepare, inspect and verify commands with receipts | Durable queue, scoped execution adapter, leases, checkpoints, cancellation and effect reconciliation |
| Policy and spend | Local records distinguish a founder ruling from a proposal. Operator mission reviews retain their evidence and reject stale submissions | Authenticated reviewer identity, grants, revocation, approval binding and transactional reservations |
| Verification | Executable navigation check and local receipt integrity checks | Independently protected verifier identity and hidden checks bound to candidate revisions |
| Founder experience | Local browser form, run list, source inspection and verification receipt | Hosted journeys, accounts, accessibility validation, notifications and operator views |
| Operations and improvement | Recorded negative tests, a retrieval repair loop and local mission evidence export | Deployments, telemetry, incident recovery, authorized workspace export, restore and evaluated promotion |

| Order | Scope | Proof required |
|---|---|---|
| 1 | Local intake, evidence inspection and verification | Prepare, exit, inspect, verify, reject a failed candidate and retain the original receipt |
| 2 | Hosted founder pilot with one authorized workflow | Real sign-in, durable project state, tenant denial and test restore under runtime roles |
| 3 | Authorized execution, approval, spending and previews | Isolated execution, correct revision, independent checks, interruption and revocation tests |
| 4 | Release, operating controls and customer lifecycle | Deployment and recovery drill, accessibility review, support ownership, usage and export checks |
| 5 | Expand skill, tool and domain coverage | Per-capability evaluation with approved access and measured outcomes |

The earliest launch audience is a proposed invite-only group of founders who can provide one bounded software task and inspect the result. Start with a founder-led walkthrough and direct feedback. Measure time to first verified outcome, accepted runs per attempt, review effort, cost per accepted outcome and recovery success. Days 1–30 establish a baseline with pilot users, days 31–60 test repeat usage and days 61–90 test broader onboarding if the operating gates pass. These are launch planning windows and hypotheses. Pricing, acquisition spend and customer outcomes require evidence.

See the [interface map](16-interface-map.md) for planned routes, components, role boundaries, recovery, and browser acceptance.

The signed-in workspace chooser now includes a recent mission activity feed across accessible workspaces. Events identify the workspace and link to the mission or catalog evidence. Database row-level security filters the feed before it reaches the browser.
