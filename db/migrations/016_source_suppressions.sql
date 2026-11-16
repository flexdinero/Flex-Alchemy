BEGIN;
CREATE TABLE alchemy.source_suppressions (
  workspace_id uuid NOT NULL,
  source_id text NOT NULL CHECK (source_id ~ '^K[0-9]+$'),
  actor_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, source_id),
  FOREIGN KEY (workspace_id, actor_id) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.source_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.source_suppressions FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.source_suppressions TO alchemy_app;
CREATE POLICY member_reads_source_suppressions ON alchemy.source_suppressions FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = source_suppressions.workspace_id));
CREATE POLICY owner_suppresses_sources ON alchemy.source_suppressions FOR INSERT TO alchemy_app
WITH CHECK (actor_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = source_suppressions.workspace_id AND m.role = 'owner'
));
COMMIT;
