BEGIN;
ALTER TABLE alchemy.missions ADD COLUMN submission_key uuid;
ALTER TABLE alchemy.missions ADD CONSTRAINT mission_submission_once
  UNIQUE (workspace_id, project_id, created_by, submission_key);
COMMIT;
