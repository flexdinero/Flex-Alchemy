BEGIN;
ALTER TABLE alchemy.memberships ADD COLUMN revoked_by uuid;
ALTER TABLE alchemy.memberships ADD FOREIGN KEY (workspace_id, revoked_by)
  REFERENCES alchemy.memberships(workspace_id, actor_id);
GRANT CREATE ON SCHEMA alchemy TO alchemy_team_reader;
GRANT UPDATE (revoked_at, revoked_by) ON alchemy.memberships TO alchemy_team_reader;
CREATE POLICY team_revokes_nonowners ON alchemy.memberships FOR UPDATE TO alchemy_team_reader
USING (role IN ('editor', 'viewer') AND revoked_at IS NULL)
WITH CHECK (role IN ('editor', 'viewer') AND revoked_at IS NOT NULL AND revoked_by = alchemy.actor_id());

CREATE FUNCTION alchemy.revoke_workspace_member(target_workspace uuid, target_actor uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE alchemy.memberships m SET revoked_at = statement_timestamp(), revoked_by = alchemy.actor_id()
  WHERE m.workspace_id = target_workspace AND m.actor_id = target_actor
    AND m.role IN ('editor', 'viewer') AND m.revoked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM alchemy.memberships owner
      WHERE owner.workspace_id = target_workspace AND owner.actor_id = alchemy.actor_id()
        AND owner.role = 'owner' AND owner.revoked_at IS NULL
    );
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION alchemy.revoke_workspace_member(uuid, uuid) FROM PUBLIC;
ALTER FUNCTION alchemy.revoke_workspace_member(uuid, uuid) OWNER TO alchemy_team_reader;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_team_reader;
GRANT EXECUTE ON FUNCTION alchemy.revoke_workspace_member(uuid, uuid) TO alchemy_app;
COMMIT;
