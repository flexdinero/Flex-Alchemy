BEGIN;
CREATE TABLE alchemy.mission_reviews (
  workspace_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  reviewer uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted', 'changes-requested')),
  evidence text NOT NULL CHECK (length(trim(evidence)) BETWEEN 1 AND 2000),
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, mission_id, version),
  FOREIGN KEY (workspace_id, mission_id) REFERENCES alchemy.missions(workspace_id, id),
  FOREIGN KEY (workspace_id, reviewer) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.mission_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.mission_reviews FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.mission_reviews TO alchemy_app;
CREATE POLICY member_reads_reviews ON alchemy.mission_reviews FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_reviews.workspace_id));
CREATE POLICY editor_records_reviews ON alchemy.mission_reviews FOR INSERT TO alchemy_app
WITH CHECK (reviewer = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_reviews.workspace_id
  AND m.role IN ('owner', 'editor')
));
COMMIT;
