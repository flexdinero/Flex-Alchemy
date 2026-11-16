BEGIN;
CREATE TABLE alchemy.release_environment_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('staging','production')),
  candidate_id uuid NOT NULL,
  previous_id uuid REFERENCES alchemy.release_environment_activations(id),
  operation text NOT NULL CHECK (operation IN ('promote','rollback')),
  activated_by uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  FOREIGN KEY (candidate_id, environment) REFERENCES alchemy.release_environment_decisions(candidate_id, environment),
  FOREIGN KEY (workspace_id, project_id) REFERENCES alchemy.projects(workspace_id,id),
  FOREIGN KEY (workspace_id, activated_by) REFERENCES alchemy.memberships(workspace_id,actor_id)
);
CREATE INDEX release_environment_activations_latest ON alchemy.release_environment_activations
  (workspace_id, project_id, environment, sequence DESC);
ALTER TABLE alchemy.release_environment_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.release_environment_activations FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT (workspace_id, project_id, environment, candidate_id, previous_id, operation, activated_by, reason)
  ON alchemy.release_environment_activations TO alchemy_app;
CREATE POLICY member_reads_release_activations ON alchemy.release_environment_activations FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = release_environment_activations.workspace_id));
CREATE POLICY owner_activates_approved_candidate ON alchemy.release_environment_activations FOR INSERT TO alchemy_app
WITH CHECK (activated_by = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = release_environment_activations.workspace_id AND m.role = 'owner')
  AND EXISTS (
    SELECT 1 FROM alchemy.release_environment_decisions d
    JOIN alchemy.release_approver_grants g ON g.id = d.grant_id
    JOIN alchemy.workspace_team(release_environment_activations.workspace_id) team ON team.actor_id = d.reviewer_id
    WHERE d.candidate_id = release_environment_activations.candidate_id
      AND d.workspace_id = release_environment_activations.workspace_id AND d.project_id = release_environment_activations.project_id
      AND d.environment = release_environment_activations.environment AND d.decision = 'approved'
      AND d.expires_at > statement_timestamp() AND g.revoked_at IS NULL AND team.revoked_at IS NULL));
COMMIT;
