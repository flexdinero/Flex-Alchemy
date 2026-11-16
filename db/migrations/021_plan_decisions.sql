BEGIN;
CREATE TABLE alchemy.mission_plan_decisions (
  workspace_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  revision integer NOT NULL,
  version integer NOT NULL,
  author_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','denied')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, mission_id, revision, version),
  FOREIGN KEY (workspace_id, mission_id, revision, version)
    REFERENCES alchemy.mission_plans(workspace_id, mission_id, revision, version),
  FOREIGN KEY (workspace_id, author_id) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.mission_plan_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.mission_plan_decisions FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.mission_plan_decisions TO alchemy_app;
CREATE POLICY member_reads_plan_decisions ON alchemy.mission_plan_decisions FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_plan_decisions.workspace_id));
CREATE POLICY owner_records_plan_decisions ON alchemy.mission_plan_decisions FOR INSERT TO alchemy_app
WITH CHECK (author_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_plan_decisions.workspace_id AND m.role = 'owner'
));
COMMIT;
