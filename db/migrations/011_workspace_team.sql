BEGIN;
CREATE ROLE alchemy_team_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT alchemy_team_reader TO CURRENT_USER;
GRANT USAGE, CREATE ON SCHEMA alchemy TO alchemy_team_reader;
GRANT SELECT ON alchemy.memberships TO alchemy_team_reader;
GRANT EXECUTE ON FUNCTION alchemy.actor_id() TO alchemy_team_reader;

CREATE POLICY team_reader_memberships ON alchemy.memberships FOR SELECT TO alchemy_team_reader USING (true);

CREATE FUNCTION alchemy.workspace_team(target_workspace uuid)
RETURNS TABLE (actor_id uuid, role text, revoked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT member.actor_id, member.role, member.revoked_at
  FROM alchemy.memberships member
  WHERE member.workspace_id = target_workspace AND EXISTS (
    SELECT 1 FROM alchemy.memberships owner
    WHERE owner.workspace_id = target_workspace AND owner.actor_id = alchemy.actor_id()
      AND owner.role = 'owner' AND owner.revoked_at IS NULL
  )
  ORDER BY (member.revoked_at IS NOT NULL), member.role, member.actor_id
$$;
REVOKE ALL ON FUNCTION alchemy.workspace_team(uuid) FROM PUBLIC;
ALTER FUNCTION alchemy.workspace_team(uuid) OWNER TO alchemy_team_reader;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_team_reader;
GRANT EXECUTE ON FUNCTION alchemy.workspace_team(uuid) TO alchemy_app;
COMMIT;
