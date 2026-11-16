BEGIN;
CREATE TABLE alchemy.plan_approval_withdrawals (
  workspace_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  revision integer NOT NULL,
  version integer NOT NULL,
  author_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, mission_id, revision, version),
  FOREIGN KEY (workspace_id, mission_id, revision, version)
    REFERENCES alchemy.mission_plan_decisions(workspace_id, mission_id, revision, version),
  FOREIGN KEY (workspace_id, author_id) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.plan_approval_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.plan_approval_withdrawals FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.plan_approval_withdrawals TO alchemy_app;
CREATE POLICY member_reads_withdrawals ON alchemy.plan_approval_withdrawals FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = plan_approval_withdrawals.workspace_id));
CREATE POLICY owner_withdraws_approvals ON alchemy.plan_approval_withdrawals FOR INSERT TO alchemy_app
WITH CHECK (author_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = plan_approval_withdrawals.workspace_id AND m.role = 'owner'
) AND EXISTS (
  SELECT 1 FROM alchemy.mission_plan_decisions d
  WHERE (d.workspace_id, d.mission_id, d.revision, d.version) =
    (plan_approval_withdrawals.workspace_id, plan_approval_withdrawals.mission_id,
     plan_approval_withdrawals.revision, plan_approval_withdrawals.version)
    AND d.decision = 'approved'
));
COMMIT;
