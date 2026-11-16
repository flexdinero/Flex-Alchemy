BEGIN;
CREATE TABLE alchemy.release_approver_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('staging','production')),
  reviewer_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_by uuid,
  revoked_at timestamptz,
  CHECK ((revoked_by IS NULL) = (revoked_at IS NULL)),
  FOREIGN KEY (workspace_id, project_id) REFERENCES alchemy.projects(workspace_id,id),
  FOREIGN KEY (workspace_id, reviewer_id) REFERENCES alchemy.memberships(workspace_id,actor_id),
  FOREIGN KEY (workspace_id, granted_by) REFERENCES alchemy.memberships(workspace_id,actor_id),
  FOREIGN KEY (workspace_id, revoked_by) REFERENCES alchemy.memberships(workspace_id,actor_id)
);
CREATE UNIQUE INDEX one_active_release_approver_grant ON alchemy.release_approver_grants
  (workspace_id, project_id, environment, reviewer_id) WHERE revoked_at IS NULL;
ALTER TABLE alchemy.release_approver_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.release_approver_grants FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT (workspace_id, project_id, environment, reviewer_id, granted_by),
  UPDATE (revoked_by, revoked_at) ON alchemy.release_approver_grants TO alchemy_app;
CREATE POLICY owner_or_reviewer_reads_release_grants ON alchemy.release_approver_grants FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = release_approver_grants.workspace_id
  AND (m.role = 'owner' OR release_approver_grants.reviewer_id = alchemy.actor_id())));
CREATE POLICY owner_creates_release_grants ON alchemy.release_approver_grants FOR INSERT TO alchemy_app
WITH CHECK (granted_by = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.workspace_team(release_approver_grants.workspace_id) member
  WHERE member.actor_id = release_approver_grants.reviewer_id AND member.revoked_at IS NULL));
CREATE POLICY owner_revokes_release_grants ON alchemy.release_approver_grants FOR UPDATE TO alchemy_app
USING (revoked_at IS NULL AND EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = release_approver_grants.workspace_id AND m.role = 'owner'))
WITH CHECK (revoked_by = alchemy.actor_id() AND revoked_at = statement_timestamp());

CREATE TABLE alchemy.release_environment_decisions (
  candidate_id uuid NOT NULL REFERENCES alchemy.archive_release_candidates(id),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('staging','production')),
  archive_sha256 text NOT NULL CHECK (archive_sha256 ~ '^[a-f0-9]{64}$'),
  grant_id uuid NOT NULL REFERENCES alchemy.release_approver_grants(id),
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','denied')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  decided_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz,
  CHECK ((decision = 'approved') = (expires_at IS NOT NULL)),
  PRIMARY KEY (candidate_id, environment),
  FOREIGN KEY (workspace_id, project_id) REFERENCES alchemy.projects(workspace_id,id),
  FOREIGN KEY (workspace_id, reviewer_id) REFERENCES alchemy.memberships(workspace_id,actor_id)
);
ALTER TABLE alchemy.release_environment_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.release_environment_decisions FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT (candidate_id, workspace_id, project_id, environment, archive_sha256, grant_id,
  reviewer_id, decision, reason, expires_at) ON alchemy.release_environment_decisions TO alchemy_app;
CREATE POLICY member_reads_release_decisions ON alchemy.release_environment_decisions FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = release_environment_decisions.workspace_id));
CREATE POLICY granted_reviewer_decides_release ON alchemy.release_environment_decisions FOR INSERT TO alchemy_app
WITH CHECK (reviewer_id = alchemy.actor_id()
  AND (decision = 'denied' OR expires_at = statement_timestamp() + interval '24 hours')
  AND EXISTS (SELECT 1 FROM alchemy.release_approver_grants g WHERE g.id = release_environment_decisions.grant_id
    AND g.workspace_id = release_environment_decisions.workspace_id AND g.project_id = release_environment_decisions.project_id
    AND g.environment = release_environment_decisions.environment AND g.reviewer_id = alchemy.actor_id() AND g.revoked_at IS NULL)
  AND EXISTS (SELECT 1 FROM alchemy.archive_release_candidates c WHERE c.id = release_environment_decisions.candidate_id
    AND c.workspace_id = release_environment_decisions.workspace_id AND c.project_id = release_environment_decisions.project_id
    AND c.archive_sha256 = release_environment_decisions.archive_sha256));
COMMIT;
