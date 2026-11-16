BEGIN;
ALTER TABLE alchemy.projects ADD COLUMN purpose text NOT NULL DEFAULT '' CHECK (length(purpose) <= 2000);
COMMIT;
