BEGIN;
ALTER TABLE alchemy.source_suppressions ADD COLUMN decision_version bigint;
ALTER TABLE alchemy.source_suppressions NO FORCE ROW LEVEL SECURITY;
WITH ordered AS (
  SELECT event_id, row_number() OVER (
    PARTITION BY workspace_id, source_id ORDER BY recorded_at, event_id
  ) AS version FROM alchemy.source_suppressions
)
UPDATE alchemy.source_suppressions s SET decision_version = ordered.version
FROM ordered WHERE s.event_id = ordered.event_id;
ALTER TABLE alchemy.source_suppressions FORCE ROW LEVEL SECURITY;
ALTER TABLE alchemy.source_suppressions ALTER COLUMN decision_version SET NOT NULL;
ALTER TABLE alchemy.source_suppressions ADD CHECK (decision_version > 0);
CREATE UNIQUE INDEX source_decision_version ON alchemy.source_suppressions (workspace_id, source_id, decision_version DESC);
DROP INDEX alchemy.source_decision_history;
COMMIT;
