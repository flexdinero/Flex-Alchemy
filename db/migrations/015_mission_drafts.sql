BEGIN;
CREATE TABLE alchemy.mission_drafts (
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) <= 100),
  goal text NOT NULL CHECK (length(goal) <= 2000),
  acceptance text NOT NULL CHECK (length(acceptance) <= 2000),
  PRIMARY KEY (workspace_id, project_id, actor_id),
  FOREIGN KEY (workspace_id, project_id) REFERENCES alchemy.projects(workspace_id, id),
  FOREIGN KEY (workspace_id, actor_id) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.mission_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.mission_drafts FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON alchemy.mission_drafts TO alchemy_app;
CREATE POLICY own_mission_drafts ON alchemy.mission_drafts TO alchemy_app
USING (actor_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_drafts.workspace_id AND m.role IN ('owner', 'editor')
));
COMMIT;
