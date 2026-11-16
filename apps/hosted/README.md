# Hosted mission intake

The hosted request handler serves workspace, project and mission listing, project and mission creation, mission review, and sign-out. Owners and editors can record mission decisions. Viewers can read decision history. Reviews record the signed-in reviewer and an evidence note. A stale form cannot replace a newer decision. Run the hosted database migrations before connecting the application.

Open **Account** to find your Flex Alchemy account ID, see which workspaces you can access, and sign out of the current browser. If you need workspace access, share the account ID with your workspace administrator. Your sign-in provider manages account recovery.

After migration 033, open **Repository** inside a project to record the exact commit and tree identifiers of a public GitHub revision. Owners and Editors can submit a repository URL and full commit SHA. Viewers can inspect the recorded revisions. GitHub is queried without credentials, and the recorded data consists of identifiers and attribution. The workflow does not download or execute repository files.

Use **Browse files for this revision** to inspect directory entries at the recorded tree. The preview follows directory references from that tree, lists up to 100 entries per page, and links to the pinned revision on GitHub for larger or deeper directories. Select a regular file to inspect up to 64 KiB of UTF-8 text. The server checks the returned bytes against the Git blob hash and escapes text in the page. Symlinks and submodules are displayed as tree entries only.

After migration 034, Owners and Editors can use **Save file to project** to store the verified bytes. All project members can reopen saved files from **Repository → Saved source files** without a GitHub request. Each snapshot retains its commit, path, blob ID, and attribution.

After migration 035, Owners and Editors can open **Repository archive** on a recorded revision and import its GitHub-generated tar.gz, up to 8 MiB compressed. Workspace members can download the saved bytes and view their SHA-256 digest. Import stores the compressed archive and does not extract it. GitHub archive behavior controls which content is included, so Git history and submodule content require separate handling.

After migration 037, workspace owners can use **Prepare release candidate** on a passing Node run. The app stores the run, pinned archive digest, author, and rationale. Workspace members can open the record from **Releases** and download the same archive. Environment approval and deployment are separate stages.

New imports stream through gzip integrity verification, enforce a 64 MiB expanded-size limit, and check the tar envelope and archived Git commit identifier before saving. These checks establish archive provenance and bounds. File-by-file extraction and execution require a separate worker.

**Download file inventory (JSON)** reads the stored archive in memory and reports entry paths, types, sizes, and SHA-256 digests for regular files. The inventory includes the pinned commit and stored archive digest, rejects duplicate or unsafe paths, and is limited to 10,000 entries.

**Compare with GitHub tree (JSON)** compares regular archive files with the pinned GitHub tree using their Git blob IDs. It lists changed, extra, and omitted paths and reports an unavailable result when the provider cannot return the complete tree. Git archive export attributes can intentionally change or omit files. The report covers regular file contents only.

With migration 029 applied, **Sign out of other Flex Alchemy sessions** revokes the account's other app sessions and keeps the current browser signed in. Provider-managed sessions are controlled through the identity provider.

Workspace members can open **Recent activity** for the latest 50 recorded mission creations and review decisions. Each entry links to its mission. Earlier missions without a recorded creation timestamp still show their recorded reviews.

Submitting the same mission form twice preserves one mission. JSON clients can send a UUID in the `Idempotency-Key` header and reuse it when retrying the same request. Reusing the key for different mission text returns HTTP 409. Keys are scoped to the signed-in actor and project.

The server expects an HTTPS public origin and a PostgreSQL pool whose trusted service login may assume `alchemy_app` and `alchemy_identity`.

Workspace members can download the current mission and its attributed review history from the mission page. The JSON attachment includes the project, goal, acceptance criteria and decision notes. Review the notes before sharing the file. Hosted run artifacts and workspace-wide backup are separate workflows.

For a project handoff, use **Download project, reviews, and verification (JSON)** from the project page. The download includes every mission visible to the member in that project, with its goal, criteria, creator, review history, and source catalog receipts, read together in one database snapshot. Missions without reviews show an empty history.

Workspace owners can download all projects, mission reviews, and source catalog receipts from the workspace page. The database checks current owner membership in the same statement that reads the bundle. The file covers project handoff records. Workspace restore, identity records and run artifacts have separate requirements.

Open **Find sources for this mission** to look up candidate references using the saved goal and acceptance criteria. The page distinguishes external references from Alchemy product records, including decisions and proposals. It reports empty matches explicitly. Lookup uses the local catalog without sending mission text to an external provider.

Create the browser flow with `discoverBrowserFlow` and pass it to `hostedApi`. Register the HTTPS public origin plus `/auth/callback` with the OIDC provider. Send the browser to `/auth/sign-in`. The callback consumes a ten-minute, browser-bound login attempt and verifies state, PKCE, nonce and the signed ID token before opening the eight-hour session. The database stores session token digests. The API resolves the actor from the session and checks the origin of writes.

With migration 031, an expired session on a workspace link sends the user through sign-in and returns them to the requested page. The destination stays with the login attempt, and workspace permissions are checked again on arrival.

Run `npm ci --ignore-scripts` and `npm run start:hosted` after configuring these environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL URL for the application service login. The driver verifies the server certificate and rejects URL SSL overrides |
| `ALCHEMY_PUBLIC_ORIGIN` | Canonical HTTPS origin, without a trailing slash |
| `OIDC_ISSUER` | Configured HTTPS issuer |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Confidential client registration values |
| `PORT` | Loopback listener port, default 4174 |
| `ALCHEMY_LISTEN_HOST` | Defaults to `127.0.0.1`. The container uses `0.0.0.0` within its network namespace |

Run the TLS reverse proxy on the same host. Preserve the public Host header and proxy to the loopback listener. The application ignores forwarded host values. Have the founder sign in once, then provision their workspace using the procedure below.

### Deploy from a container

Build from the repository root with `docker build --pull -t flex-alchemy:staging .`. Run migrations separately with an operator-only environment file, then launch the app with a runtime-only environment file. The following commands assume `PORT` is left at its default.

```text
docker run --rm --env-file /secure/alchemy-migration.env flex-alchemy:staging node db/migrate.mjs
docker run -d --restart unless-stopped --name flex-alchemy --env-file /secure/alchemy-runtime.env -p 127.0.0.1:4174:4174 flex-alchemy:staging
```

Point the host's HTTPS proxy at `127.0.0.1:4174` and preserve the canonical public Host header. Verify `/health/ready` through that HTTPS origin, then complete a real sign-in, provision the founder workspace, and exercise project creation, refresh, an unrelated account's access denial, and sign-out. Record the deployed image digest and keep the previous deployable image for recovery.

Set `ALCHEMY_MIGRATION_DATABASE_URL` to the TLS-configured PostgreSQL URL of a migration account authorized to create roles and schemas, then run `npm run migrate:hosted`. The command applies pending migrations in one transaction, records each checksum, and stops if the recorded history differs from the checked-out files. For a database previously migrated manually, reconcile its migration history before using this command. Provision a separate application login with permission to assume `alchemy_app` and `alchemy_identity`, without granting it schema ownership or direct administrative privileges. Configure a trusted certificate chain for PostgreSQL before starting the application.

Run the hosted process under a service manager with access to the configured secrets. Startup checks database connectivity, role membership, required schema objects and OIDC discovery before opening the listener. Treat the listener message as a startup signal. Through the public proxy, verify that the homepage loads, the sign-in link redirects to the configured issuer, and an authorized account can complete a mission submission. The application closes its listener and drains its connection pool on SIGINT or SIGTERM.

Configure the supervisor or proxy to check `GET /health/ready` with the configured public Host header. The endpoint reports database reachability with HTTP 200 or 503 and does not disclose dependency details. The service allows 30 seconds for graceful shutdown before it exits with a failure code.

Before listening, the server uses the configured service login in a read-only transaction. It refuses elevated login roles, checks that the service can assume both application roles, verifies forced row security and required schema capabilities, and exercises a session lookup. Run `node --test db/check-database.test.mjs` to reproduce the embedded PostgreSQL acceptance and denial checks.

Run `node --test apps/hosted/api.test.mjs apps/hosted/oidc.test.mjs db/session.test.mjs`. The tests exercise the HTTP browser routes against embedded PostgreSQL and use a fixture for the OIDC token endpoint and public keys. The server removes expired login attempts and sessions at startup and hourly while running. Verify the deployed proxy, provider registration and real hosted pool before releasing.

Each mission links to source catalog verification. Owners and editors can run the deployed catalog checker after accepting the mission. Workspace members can inspect saved receipts. Apply migration 010 before starting this version.

Workspace activity links catalog check results to the mission’s verification page. Mission, project, and workspace JSON exports include all visible catalog receipts as "catalogChecks".

## Provision the first workspace owner

1. Have the founder sign in through the hosted app once.
2. Obtain the exact OIDC issuer and subject for the founder from your identity provider’s administrative records. Preserve case and any trailing slash. Use a new workspace UUID and retain it for retries.
3. From a trusted operator environment, set the TLS-configured migration database URL to an operator login that can read verified identities and provision workspaces through forced row-level security, then run:

   ```text
   npm run provision:workspace -- <workspace-uuid> "Workspace name" "<oidc-issuer>" "<oidc-subject>"
   ```

4. Have the founder reload the app and open their workspace. A matching retry reports that the workspace is already provisioned. A different identity, renamed workspace, or revoked membership requires operator investigation.


Keep the provisioning URL out of the web service environment. The application login is restricted by row-level security and cannot provision workspace owners.

Workspace owners can open **Team access** to see account IDs, roles, and active or revoked status. Apply migration 011 before starting this version.

After migration 012, workspace owners can revoke editor and viewer access from Team access. Revocation preserves earlier records, retains the revoked membership, and records the acting owner in PostgreSQL.

After migration 030, a workspace owner can open **Team access → Grant access** and add a person who has signed in and shared their Flex Alchemy account ID. The grant records the owner, role, and time. Use this workflow for new memberships. Active and revoked membership records retain their existing history.

After migration 032, use **Team access → Change role** to switch an active Viewer or Editor. The confirmation applies to the role shown. Role change history records the actor, old and new roles, and time.

Migration 013 adds hosted mission revisions. Owners and editors can revise the goal and acceptance criteria. Each new revision awaits its own review, and previous decisions and receipts remain available in history and JSON exports.

Mission revisions appear in workspace activity and on the signed-in home feed with a link to the exact revision. Verification history labels receipts from earlier reviews as historical.

Activity links and verification history can open an individual receipt by review version and both input digests. The link remains scoped to the mission and workspace.

An individual receipt page also offers a JSON download with the mission, workspace, project, and exact recorded check.

Open **Project evidence** to find recent source catalog checks across that project's missions. Filter by result and open the exact receipt for its inputs and JSON download.

Before running a catalog check, open **Inspect verification plan**. It shows the review, steps, side effects, and input digests. A stale plan returns a conflict and links to the updated plan.

The plan links to a preview and byte-for-byte download of the catalog it will check. Old preview links report that the snapshot is unavailable if the deployed catalog changes.

Migration 014 stores the catalog bytes with new receipts. Open a receipt to download its saved input. Older receipts retain their original digest and indicate that no input was saved.

Migration 015 adds a private saved mission draft per editor or owner per project. Save draft retains incomplete fields across reloads. Publishing clears a draft with matching content in the same transaction.

The workspace **Knowledge** page searches the deployed link-only source register by ID, title, class, and proposed application. It shows the catalog digest and the limits of its rights review.

With migration 016, workspace owners can suppress a catalog reference from hosted mission lookup. The record remains visible with the reason, actor, and timestamp. Suppression applies within the workspace.

Migration 017 adds lookup decision history. Owners can restore or suppress a reference from its Knowledge record. The latest decision controls lookup and earlier reasons remain visible.

Migration 018 orders lookup decisions by per-source version. Timestamps remain visible for audit. Startup checks for the version index.

Migration 019 adds an owner-only access revocation view linked from Team access. The view shows the affected account, role, time, and revoking account where recorded.

**New mission** opens a dedicated intake page. The dedicated page and the project form share the founder's saved draft and both open the saved mission after creation.
