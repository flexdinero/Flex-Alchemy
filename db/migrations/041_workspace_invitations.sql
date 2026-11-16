BEGIN;
CREATE TABLE alchemy.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES alchemy.workspaces(id),
  workspace_name text NOT NULL,
  invitee_id uuid NOT NULL REFERENCES alchemy.actor_identities(actor_id),
  invited_by uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '168 hours'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','accepted','declined','revoked')),
  decided_at timestamptz,
  decided_by uuid REFERENCES alchemy.actor_identities(actor_id),
  CHECK ((state = 'pending') = (decided_at IS NULL AND decided_by IS NULL)),
  FOREIGN KEY (workspace_id, invited_by) REFERENCES alchemy.memberships(workspace_id,actor_id)
);
CREATE INDEX workspace_invitations_workspace ON alchemy.workspace_invitations (workspace_id,created_at DESC,id);
CREATE INDEX workspace_invitations_inbox ON alchemy.workspace_invitations (invitee_id,created_at DESC,id);
ALTER TABLE alchemy.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.workspace_invitations FORCE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE (state,decided_at,decided_by) ON alchemy.workspace_invitations TO alchemy_app;
CREATE POLICY recipient_or_owner_reads_workspace_invites ON alchemy.workspace_invitations FOR SELECT TO alchemy_app
USING (invitee_id = alchemy.actor_id() OR EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = workspace_invitations.workspace_id AND m.role = 'owner'));
CREATE POLICY owner_revokes_workspace_invite ON alchemy.workspace_invitations FOR UPDATE TO alchemy_app
USING (state = 'pending' AND expires_at > statement_timestamp() AND EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = workspace_invitations.workspace_id AND m.role = 'owner'))
WITH CHECK (state = 'revoked' AND decided_by = alchemy.actor_id() AND decided_at = statement_timestamp());

GRANT SELECT, INSERT (workspace_id,workspace_name,invitee_id,invited_by,role),
  UPDATE (state,decided_at,decided_by) ON alchemy.workspace_invitations TO alchemy_team_reader;
GRANT SELECT (id,name) ON alchemy.workspaces TO alchemy_team_reader;
GRANT CREATE ON SCHEMA alchemy TO alchemy_team_reader;
CREATE POLICY team_reads_owned_workspaces ON alchemy.workspaces FOR SELECT TO alchemy_team_reader
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = workspaces.id
  AND m.actor_id = alchemy.actor_id() AND m.role = 'owner' AND m.revoked_at IS NULL));
CREATE POLICY team_reads_invitation_parties ON alchemy.workspace_invitations FOR SELECT TO alchemy_team_reader
USING (invitee_id = alchemy.actor_id() OR invited_by = alchemy.actor_id());
CREATE POLICY team_issues_workspace_invites ON alchemy.workspace_invitations FOR INSERT TO alchemy_team_reader
WITH CHECK (invited_by = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.workspaces w WHERE w.id = workspace_invitations.workspace_id AND w.name = workspace_invitations.workspace_name));
CREATE POLICY team_records_invitation_response ON alchemy.workspace_invitations FOR UPDATE TO alchemy_team_reader
USING (invitee_id = alchemy.actor_id() AND state = 'pending' AND expires_at > statement_timestamp())
WITH CHECK (invitee_id = alchemy.actor_id() AND state IN ('accepted','declined') AND decided_by = alchemy.actor_id()
  AND decided_at = statement_timestamp());
CREATE POLICY team_grants_invited_membership ON alchemy.memberships FOR INSERT TO alchemy_team_reader
WITH CHECK (actor_id = alchemy.actor_id() AND revoked_at IS NULL AND revoked_by IS NULL AND granted_at = statement_timestamp()
  AND EXISTS (SELECT 1 FROM alchemy.workspace_invitations i WHERE i.workspace_id = memberships.workspace_id
    AND i.invitee_id = memberships.actor_id AND i.invited_by = memberships.granted_by
    AND i.role = memberships.role AND i.state = 'pending' AND i.expires_at > statement_timestamp()));

CREATE FUNCTION alchemy.issue_workspace_invitation(target_workspace uuid, target_actor uuid, target_role text)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  target_name text;
  invitation uuid;
BEGIN
  IF target_role IS NULL OR target_role NOT IN ('editor','viewer') THEN RETURN NULL; END IF;
  SELECT w.name INTO target_name FROM alchemy.workspaces w WHERE w.id = target_workspace;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM alchemy.actor_identities a WHERE a.actor_id = target_actor)
    OR EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = target_workspace AND m.actor_id = target_actor)
    THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('invite:' || target_workspace::text || ':' || target_actor::text,0));
  SELECT i.id INTO invitation FROM alchemy.workspace_invitations i WHERE i.workspace_id = target_workspace
    AND i.invitee_id = target_actor AND i.role = target_role AND i.state = 'pending' AND i.expires_at > statement_timestamp()
    ORDER BY i.created_at DESC LIMIT 1;
  IF FOUND THEN RETURN invitation; END IF;
  INSERT INTO alchemy.workspace_invitations (workspace_id,workspace_name,invitee_id,invited_by,role)
    VALUES (target_workspace,target_name,target_actor,alchemy.actor_id(),target_role) RETURNING id INTO invitation;
  RETURN invitation;
END;
$$;

CREATE FUNCTION alchemy.respond_workspace_invitation(invitation uuid, response text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE invite alchemy.workspace_invitations%ROWTYPE;
BEGIN
  IF response IS NULL OR response NOT IN ('accepted','declined') THEN RETURN 'unavailable'; END IF;
  SELECT i.* INTO invite FROM alchemy.workspace_invitations i WHERE i.id = invitation
    AND i.invitee_id = alchemy.actor_id() AND i.state = 'pending' AND i.expires_at > statement_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unavailable'; END IF;
  IF response = 'accepted' THEN
    IF NOT EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = invite.workspace_id
      AND m.actor_id = invite.invited_by AND m.role = 'owner' AND m.revoked_at IS NULL) THEN RETURN 'unavailable'; END IF;
    INSERT INTO alchemy.memberships (workspace_id,actor_id,role,granted_by,granted_at)
      VALUES (invite.workspace_id,invite.invitee_id,invite.role,invite.invited_by,statement_timestamp())
      ON CONFLICT (workspace_id,actor_id) DO NOTHING;
    IF NOT FOUND THEN RETURN 'conflict'; END IF;
  END IF;
  UPDATE alchemy.workspace_invitations SET state = response, decided_at = statement_timestamp(), decided_by = alchemy.actor_id()
    WHERE id = invitation;
  RETURN response;
END;
$$;
REVOKE ALL ON FUNCTION alchemy.issue_workspace_invitation(uuid,uuid,text), alchemy.respond_workspace_invitation(uuid,text) FROM PUBLIC;
ALTER FUNCTION alchemy.issue_workspace_invitation(uuid,uuid,text) OWNER TO alchemy_team_reader;
ALTER FUNCTION alchemy.respond_workspace_invitation(uuid,text) OWNER TO alchemy_team_reader;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_team_reader;
GRANT EXECUTE ON FUNCTION alchemy.issue_workspace_invitation(uuid,uuid,text), alchemy.respond_workspace_invitation(uuid,text) TO alchemy_app;
COMMIT;
