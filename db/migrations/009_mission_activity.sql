BEGIN;
ALTER TABLE alchemy.missions ADD COLUMN created_at timestamptz;
ALTER TABLE alchemy.missions ALTER COLUMN created_at SET DEFAULT statement_timestamp();
CREATE INDEX mission_activity_created ON alchemy.missions (workspace_id, created_at DESC) WHERE created_at IS NOT NULL;
CREATE INDEX mission_activity_reviewed ON alchemy.mission_reviews (workspace_id, recorded_at DESC);
COMMIT;
