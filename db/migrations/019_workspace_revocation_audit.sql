BEGIN;
GRANT CREATE ON SCHEMA alchemy TO alchemy_team_reader;
CREATE FUNCTION alchemy.workspace_revocation_audit(target_workspace uuid)
RETURNS TABLE (actor_id uuid, revoked_by uuid, revoked_at timestamptz, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT member.actor_id, member.revoked_by, member.revoked_at, member.role
  FROM alchemy.memberships member
  WHERE member.workspace_id = target_workspace AND member.revoked_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM alchemy.memberships owner
      WHERE owner.workspace_id = target_workspace AND owner.actor_id = alchemy.actor_id()
        AND owner.role = 'owner' AND owner.revoked_at IS NULL
    )
  ORDER BY member.revoked_at DESC, member.actor_id LIMIT 50
$$;
REVOKE ALL ON FUNCTION alchemy.workspace_revocation_audit(uuid) FROM PUBLIC;
ALTER FUNCTION alchemy.workspace_revocation_audit(uuid) OWNER TO alchemy_team_reader;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_team_reader;
GRANT EXECUTE ON FUNCTION alchemy.workspace_revocation_audit(uuid) TO alchemy_app;
COMMIT;
