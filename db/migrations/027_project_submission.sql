BEGIN;
ALTER TABLE alchemy.projects ADD COLUMN submission_key uuid;
ALTER TABLE alchemy.projects ADD COLUMN submission_actor uuid;
ALTER TABLE alchemy.projects ADD COLUMN submission_digest text;
ALTER TABLE alchemy.projects ADD CONSTRAINT project_submission_once UNIQUE (workspace_id, submission_actor, submission_key);
COMMIT;
