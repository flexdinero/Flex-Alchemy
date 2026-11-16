BEGIN;
GRANT INSERT ON alchemy.projects TO alchemy_app;
CREATE POLICY editor_creates_projects ON alchemy.projects FOR INSERT TO alchemy_app
WITH CHECK (EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = projects.workspace_id
  AND m.role IN ('owner', 'editor')
));
COMMIT;
