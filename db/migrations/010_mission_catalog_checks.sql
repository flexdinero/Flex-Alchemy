BEGIN;
CREATE TABLE alchemy.mission_catalog_checks (
  workspace_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  review_version integer NOT NULL,
  actor_id uuid NOT NULL,
  catalog_sha256 text NOT NULL CHECK (catalog_sha256 ~ '^[a-f0-9]{64}$'),
  checker_sha256 text NOT NULL CHECK (checker_sha256 ~ '^[a-f0-9]{64}$'),
  record_count integer NOT NULL CHECK (record_count >= 0),
  failures text[] NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, mission_id, review_version, catalog_sha256, checker_sha256),
  FOREIGN KEY (workspace_id, mission_id, review_version) REFERENCES alchemy.mission_reviews(workspace_id, mission_id, version),
  FOREIGN KEY (workspace_id, actor_id) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.mission_catalog_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.mission_catalog_checks FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.mission_catalog_checks TO alchemy_app;
CREATE POLICY member_reads_catalog_checks ON alchemy.mission_catalog_checks FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_catalog_checks.workspace_id));
CREATE POLICY editor_records_catalog_checks ON alchemy.mission_catalog_checks FOR INSERT TO alchemy_app
WITH CHECK (actor_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = mission_catalog_checks.workspace_id
  AND m.role IN ('owner', 'editor')
) AND review_version = (
  SELECT max(r.version) FROM alchemy.mission_reviews r
  WHERE r.workspace_id = mission_catalog_checks.workspace_id AND r.mission_id = mission_catalog_checks.mission_id
) AND EXISTS (
  SELECT 1 FROM alchemy.mission_reviews r WHERE r.workspace_id = mission_catalog_checks.workspace_id
  AND r.mission_id = mission_catalog_checks.mission_id AND r.version = mission_catalog_checks.review_version
  AND r.decision = 'accepted'
));
COMMIT;
