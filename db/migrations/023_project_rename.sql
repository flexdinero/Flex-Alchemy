BEGIN;
GRANT UPDATE (name) ON alchemy.projects TO alchemy_app;
CREATE POLICY editor_renames_projects ON alchemy.projects FOR UPDATE TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = projects.workspace_id AND m.role IN ('owner', 'editor')));
COMMIT;
