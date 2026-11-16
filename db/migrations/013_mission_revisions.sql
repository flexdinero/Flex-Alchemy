BEGIN;
CREATE TABLE alchemy.mission_revisions (
  workspace_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 1),
  goal text NOT NULL CHECK (length(trim(goal)) BETWEEN 1 AND 2000),
  acceptance text NOT NULL CHECK (length(trim(acceptance)) BETWEEN 1 AND 2000),
  author_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, mission_id, revision),
  FOREIGN KEY (workspace_id, mission_id) REFERENCES alchemy.missions(workspace_id, id),
  FOREIGN KEY (workspace_id, author_id) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.mission_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.mission_revisions FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.mission_revisions TO alchemy_app;
CREATE POLICY member_reads_revisions ON alchemy.mission_revisions FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_revisions.workspace_id));
CREATE POLICY editor_records_revisions ON alchemy.mission_revisions FOR INSERT TO alchemy_app
WITH CHECK (author_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_revisions.workspace_id
  AND m.role IN ('owner', 'editor')
));
ALTER TABLE alchemy.mission_reviews ADD COLUMN mission_revision integer NOT NULL DEFAULT 1 CHECK (mission_revision > 0);
COMMIT;
