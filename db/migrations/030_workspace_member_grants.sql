BEGIN;
ALTER TABLE alchemy.memberships
  ADD COLUMN granted_at timestamptz,
  ADD COLUMN granted_by uuid,
  ADD FOREIGN KEY (workspace_id, granted_by) REFERENCES alchemy.memberships(workspace_id, actor_id),
  ADD CHECK ((granted_at IS NULL) = (granted_by IS NULL));

GRANT CREATE ON SCHEMA alchemy TO alchemy_team_reader;
GRANT SELECT (actor_id) ON alchemy.actor_identities TO alchemy_team_reader;
GRANT INSERT (workspace_id, actor_id, role, granted_by, granted_at)
  ON alchemy.memberships TO alchemy_team_reader;
CREATE POLICY team_grants_nonowners ON alchemy.memberships FOR INSERT TO alchemy_team_reader
WITH CHECK (role IN ('viewer', 'editor') AND revoked_at IS NULL AND revoked_by IS NULL
  AND granted_by = alchemy.actor_id() AND granted_at = statement_timestamp());

CREATE FUNCTION alchemy.grant_workspace_member(target_workspace uuid, target_actor uuid, target_role text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  IF target_role IS NULL OR target_role NOT IN ('editor', 'viewer') THEN RETURN false; END IF;

  INSERT INTO alchemy.memberships (workspace_id, actor_id, role, granted_by, granted_at)
  SELECT target_workspace, target_actor, target_role, alchemy.actor_id(), statement_timestamp()
  WHERE EXISTS (
    SELECT 1 FROM alchemy.memberships owner
    WHERE owner.workspace_id = target_workspace AND owner.actor_id = alchemy.actor_id()
      AND owner.role = 'owner' AND owner.revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM alchemy.actor_identities identity WHERE identity.actor_id = target_actor
  )
  ON CONFLICT (workspace_id, actor_id) DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION alchemy.grant_workspace_member(uuid, uuid, text) FROM PUBLIC;
ALTER FUNCTION alchemy.grant_workspace_member(uuid, uuid, text) OWNER TO alchemy_team_reader;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_team_reader;
GRANT EXECUTE ON FUNCTION alchemy.grant_workspace_member(uuid, uuid, text) TO alchemy_app;
COMMIT;
