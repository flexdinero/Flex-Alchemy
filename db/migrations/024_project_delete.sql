BEGIN;
GRANT DELETE ON alchemy.projects TO alchemy_app;
CREATE POLICY owner_deletes_projects ON alchemy.projects FOR DELETE TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = projects.workspace_id AND m.role = 'owner'));
COMMIT;
