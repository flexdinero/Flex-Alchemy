BEGIN;

CREATE ROLE alchemy_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA alchemy;
REVOKE ALL ON SCHEMA alchemy FROM PUBLIC;
GRANT USAGE ON SCHEMA alchemy TO alchemy_app;

CREATE TABLE alchemy.workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100)
);
CREATE TABLE alchemy.memberships (
  workspace_id uuid NOT NULL REFERENCES alchemy.workspaces(id),
  actor_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  revoked_at timestamptz,
  PRIMARY KEY (workspace_id, actor_id)
);
CREATE TABLE alchemy.projects (
  workspace_id uuid NOT NULL REFERENCES alchemy.workspaces(id),
  id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  PRIMARY KEY (workspace_id, id)
);
CREATE TABLE alchemy.missions (
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  id uuid NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
  goal text NOT NULL CHECK (length(trim(goal)) BETWEEN 1 AND 2000),
  acceptance text NOT NULL CHECK (length(trim(acceptance)) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, project_id) REFERENCES alchemy.projects(workspace_id, id),
  FOREIGN KEY (workspace_id, created_by) REFERENCES alchemy.memberships(workspace_id, actor_id)
);

-- The trusted application backend sets this transaction-local value after authentication.
-- The runtime database role is for that backend only, never for browser or worker clients.
CREATE FUNCTION alchemy.actor_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = pg_catalog
AS $$ SELECT NULLIF(current_setting('alchemy.actor_id', true), '')::uuid $$;
REVOKE ALL ON FUNCTION alchemy.actor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alchemy.actor_id() TO alchemy_app;

ALTER TABLE alchemy.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE alchemy.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE alchemy.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE alchemy.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.missions FORCE ROW LEVEL SECURITY;

GRANT SELECT ON alchemy.workspaces, alchemy.memberships, alchemy.projects, alchemy.missions TO alchemy_app;
GRANT INSERT ON alchemy.missions TO alchemy_app;
CREATE POLICY own_memberships ON alchemy.memberships FOR SELECT TO alchemy_app
USING (actor_id = alchemy.actor_id() AND revoked_at IS NULL);
CREATE POLICY member_workspaces ON alchemy.workspaces FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = workspaces.id));
CREATE POLICY member_projects ON alchemy.projects FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = projects.workspace_id));
CREATE POLICY member_missions ON alchemy.missions FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = missions.workspace_id));
CREATE POLICY editor_creates_missions ON alchemy.missions FOR INSERT TO alchemy_app
WITH CHECK (created_by = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = missions.workspace_id
  AND m.role IN ('owner', 'editor')
));

COMMIT;
