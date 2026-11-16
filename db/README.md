# Hosted workspace database

The first PostgreSQL migration defines workspaces, memberships, projects and mission intake. Apply it once using the migration owner in a fresh database. The migration owner provisions workspaces, projects and memberships. The application role has scoped reads and mission creation privileges. Editors and owners can create missions, while viewers can read. Revoking a membership ends access and preserves attribution on earlier missions.

The backend must verify the session, then set `alchemy.actor_id` within the same transaction as its queries. Only the trusted backend may assume `alchemy_app`. Keep its credentials out of browser clients, arbitrary SQL interfaces and workers. A transaction without actor context returns no workspace records. This migration leaves identity provider wiring, administrative workflows and hosted connection configuration to subsequent changes.

`workspace-store.mjs` implements workspace and project listing, mission listing and mission creation. Its pool interface accepts a checked-out client with `query` and `release`, as provided by node-postgres. Every operation uses one transaction with a local role and actor ID. Configure the hosted login with no inherited elevated privileges and grant it only the ability to assume `alchemy_app`. Pass only the actor ID derived from an authenticated server session to the store.

Run `npm ci --ignore-scripts` and `node --test db/workspace-boundary.test.mjs` to exercise the migration on embedded PostgreSQL. The checks cover role flags, workspace visibility, viewer writes, cross-workspace project references, actor attribution, and membership revocation. Hosted login, connection pooling and deployment verification require the target environment.
