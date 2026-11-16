BEGIN;
CREATE TABLE alchemy.workspace_member_role_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  previous_role text NOT NULL CHECK (previous_role IN ('editor', 'viewer')),
  new_role text NOT NULL CHECK (new_role IN ('editor', 'viewer') AND new_role <> previous_role),
  changed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  FOREIGN KEY (workspace_id, actor_id) REFERENCES alchemy.memberships(workspace_id, actor_id),
  FOREIGN KEY (workspace_id, changed_by) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
CREATE INDEX workspace_member_role_changes_recent ON alchemy.workspace_member_role_changes (workspace_id, changed_at DESC, id);
ALTER TABLE alchemy.workspace_member_role_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.workspace_member_role_changes FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.workspace_member_role_changes TO alchemy_team_reader;
CREATE POLICY team_reads_role_changes ON alchemy.workspace_member_role_changes FOR SELECT TO alchemy_team_reader
USING (EXISTS (SELECT 1 FROM alchemy.memberships owner
  WHERE owner.workspace_id = workspace_member_role_changes.workspace_id AND owner.actor_id = alchemy.actor_id()
    AND owner.role = 'owner' AND owner.revoked_at IS NULL));
CREATE POLICY team_records_role_changes ON alchemy.workspace_member_role_changes FOR INSERT TO alchemy_team_reader
WITH CHECK (changed_by = alchemy.actor_id());

GRANT CREATE ON SCHEMA alchemy TO alchemy_team_reader;
GRANT UPDATE (role) ON alchemy.memberships TO alchemy_team_reader;
CREATE POLICY team_changes_nonowner_roles ON alchemy.memberships FOR UPDATE TO alchemy_team_reader
USING (role IN ('editor', 'viewer') AND revoked_at IS NULL)
WITH CHECK (role IN ('editor', 'viewer') AND revoked_at IS NULL AND revoked_by IS NULL);

CREATE FUNCTION alchemy.change_workspace_member_role(target_workspace uuid, target_actor uuid, expected_role text, replacement_role text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  IF expected_role IS NULL OR expected_role NOT IN ('viewer', 'editor')
    OR replacement_role IS NULL OR replacement_role NOT IN ('viewer', 'editor')
    OR expected_role = replacement_role THEN RETURN false; END IF;
  UPDATE alchemy.memberships member SET role = replacement_role
  WHERE member.workspace_id = target_workspace AND member.actor_id = target_actor
    AND member.role = expected_role AND member.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM alchemy.memberships owner
      WHERE owner.workspace_id = target_workspace AND owner.actor_id = alchemy.actor_id()
        AND owner.role = 'owner' AND owner.revoked_at IS NULL);
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO alchemy.workspace_member_role_changes (workspace_id, actor_id, changed_by, previous_role, new_role)
  VALUES (target_workspace, target_actor, alchemy.actor_id(), expected_role, replacement_role);
  RETURN true;
END;
$$;

CREATE FUNCTION alchemy.workspace_member_role_history(target_workspace uuid)
RETURNS TABLE (actor_id uuid, changed_by uuid, previous_role text, new_role text, changed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT event.actor_id, event.changed_by, event.previous_role, event.new_role, event.changed_at
  FROM alchemy.workspace_member_role_changes event WHERE event.workspace_id = target_workspace
  ORDER BY event.changed_at DESC, event.id LIMIT 50
$$;
REVOKE ALL ON FUNCTION alchemy.change_workspace_member_role(uuid, uuid, text, text),
  alchemy.workspace_member_role_history(uuid) FROM PUBLIC;
ALTER FUNCTION alchemy.change_workspace_member_role(uuid, uuid, text, text) OWNER TO alchemy_team_reader;
ALTER FUNCTION alchemy.workspace_member_role_history(uuid) OWNER TO alchemy_team_reader;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_team_reader;
GRANT EXECUTE ON FUNCTION alchemy.change_workspace_member_role(uuid, uuid, text, text),
  alchemy.workspace_member_role_history(uuid) TO alchemy_app;
COMMIT;
