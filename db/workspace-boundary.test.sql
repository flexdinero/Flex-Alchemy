\set ON_ERROR_STOP on

-- Run against a disposable database after applying all migrations in order.
BEGIN;
INSERT INTO alchemy.workspaces VALUES
  ('00000000-0000-4000-8000-000000000001', 'Test workspace');
INSERT INTO alchemy.memberships (workspace_id, actor_id, role) VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'editor');
INSERT INTO alchemy.projects VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'Test project');
SET LOCAL ROLE alchemy_app;

DO $$
BEGIN
  IF EXISTS (SELECT FROM alchemy.projects) THEN
    RAISE EXCEPTION 'Projects must be invisible without an actor';
  END IF;
END
$$;

SELECT set_config('alchemy.actor_id', '00000000-0000-4000-8000-000000000002', true);
INSERT INTO alchemy.missions (workspace_id, project_id, id, title, goal, acceptance, created_by) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  'Verify the launch journey', 'Inspect the release', 'Record the result',
  '00000000-0000-4000-8000-000000000002'
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM alchemy.missions
    WHERE id = '00000000-0000-4000-8000-000000000004'
  ) THEN
    RAISE EXCEPTION 'The editor must be able to read the mission they created';
  END IF;
END
$$;
ROLLBACK;
