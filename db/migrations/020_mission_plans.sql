BEGIN;
CREATE TABLE alchemy.mission_plans (
  workspace_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  version integer NOT NULL CHECK (version > 0),
  steps text NOT NULL CHECK (length(trim(steps)) BETWEEN 1 AND 4000),
  author_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, mission_id, revision, version),
  FOREIGN KEY (workspace_id, mission_id) REFERENCES alchemy.missions(workspace_id, id),
  FOREIGN KEY (workspace_id, author_id) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.mission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.mission_plans FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.mission_plans TO alchemy_app;
CREATE POLICY member_reads_plans ON alchemy.mission_plans FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_plans.workspace_id));
CREATE POLICY editor_records_plans ON alchemy.mission_plans FOR INSERT TO alchemy_app
WITH CHECK (author_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_plans.workspace_id AND m.role IN ('owner', 'editor')
));
COMMIT;
