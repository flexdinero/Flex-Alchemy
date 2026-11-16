BEGIN;
CREATE ROLE alchemy_workspace_creator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT alchemy_workspace_creator TO CURRENT_USER;
GRANT USAGE, CREATE ON SCHEMA alchemy TO alchemy_workspace_creator;
GRANT EXECUTE ON FUNCTION alchemy.actor_id() TO alchemy_workspace_creator;
GRANT SELECT (actor_id) ON alchemy.actor_identities TO alchemy_workspace_creator;
GRANT INSERT (id, name) ON alchemy.workspaces TO alchemy_workspace_creator;
GRANT INSERT (workspace_id, actor_id, role) ON alchemy.memberships TO alchemy_workspace_creator;
GRANT SELECT (workspace_id, actor_id, role, revoked_at) ON alchemy.memberships TO alchemy_workspace_creator;

CREATE TABLE alchemy.workspace_onboarding_requests (
  actor_id uuid NOT NULL REFERENCES alchemy.actor_identities(actor_id),
  submission_key uuid NOT NULL,
  workspace_id uuid NOT NULL UNIQUE REFERENCES alchemy.workspaces(id),
  submitted_name text NOT NULL CHECK (length(btrim(submitted_name)) BETWEEN 1 AND 100),
  submitted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (actor_id, submission_key)
);
ALTER TABLE alchemy.workspace_onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.workspace_onboarding_requests FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT (actor_id, submission_key, workspace_id, submitted_name)
  ON alchemy.workspace_onboarding_requests TO alchemy_workspace_creator;
CREATE POLICY creator_reads_own_workspace_requests ON alchemy.workspace_onboarding_requests FOR SELECT TO alchemy_workspace_creator
USING (actor_id = alchemy.actor_id());
CREATE POLICY creator_records_own_workspace_requests ON alchemy.workspace_onboarding_requests FOR INSERT TO alchemy_workspace_creator
WITH CHECK (actor_id = alchemy.actor_id());
CREATE POLICY creator_inserts_workspace ON alchemy.workspaces FOR INSERT TO alchemy_workspace_creator
WITH CHECK (alchemy.actor_id() IS NOT NULL);
CREATE POLICY creator_inserts_own_membership ON alchemy.memberships FOR INSERT TO alchemy_workspace_creator
WITH CHECK (actor_id = alchemy.actor_id() AND role = 'owner' AND revoked_at IS NULL);
CREATE POLICY creator_reads_own_membership ON alchemy.memberships FOR SELECT TO alchemy_workspace_creator
USING (actor_id = alchemy.actor_id() AND revoked_at IS NULL);

CREATE FUNCTION alchemy.create_owned_workspace(request_key uuid, workspace_name text)
RETURNS TABLE (status text, workspace_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  requester uuid := alchemy.actor_id();
  target uuid;
  existing_name text;
BEGIN
  IF request_key IS NULL OR workspace_name IS NULL OR length(btrim(workspace_name)) NOT BETWEEN 1 AND 100
    OR NOT EXISTS (SELECT 1 FROM alchemy.actor_identities i WHERE i.actor_id = requester) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace:' || requester::text || ':' || request_key::text, 0));
  SELECT r.workspace_id, r.submitted_name INTO target, existing_name FROM alchemy.workspace_onboarding_requests r
    WHERE r.actor_id = requester AND r.submission_key = request_key;
  IF FOUND THEN
    IF existing_name = workspace_name AND EXISTS (SELECT 1 FROM alchemy.memberships m
      WHERE m.workspace_id = target AND m.actor_id = requester AND m.role = 'owner' AND m.revoked_at IS NULL) THEN
      RETURN QUERY SELECT 'existing'::text, target;
    ELSE
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid;
    END IF;
    RETURN;
  END IF;
  target := gen_random_uuid();
  INSERT INTO alchemy.workspaces (id, name) VALUES (target, workspace_name);
  INSERT INTO alchemy.memberships (workspace_id, actor_id, role) VALUES (target, requester, 'owner');
  INSERT INTO alchemy.workspace_onboarding_requests (actor_id, submission_key, workspace_id, submitted_name)
    VALUES (requester, request_key, target, workspace_name);
  RETURN QUERY SELECT 'created'::text, target;
END;
$$;
REVOKE ALL ON FUNCTION alchemy.create_owned_workspace(uuid,text) FROM PUBLIC;
ALTER FUNCTION alchemy.create_owned_workspace(uuid,text) OWNER TO alchemy_workspace_creator;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_workspace_creator;
GRANT EXECUTE ON FUNCTION alchemy.create_owned_workspace(uuid,text) TO alchemy_app;
COMMIT;
