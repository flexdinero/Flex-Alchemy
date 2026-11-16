BEGIN;
ALTER TABLE alchemy.source_suppressions ADD COLUMN event_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE alchemy.source_suppressions DROP CONSTRAINT source_suppressions_pkey;
ALTER TABLE alchemy.source_suppressions ADD PRIMARY KEY (event_id);
ALTER TABLE alchemy.source_suppressions ADD COLUMN suppressed boolean NOT NULL DEFAULT true;
CREATE INDEX source_decision_history ON alchemy.source_suppressions (workspace_id, source_id, recorded_at DESC, event_id DESC);
COMMIT;
