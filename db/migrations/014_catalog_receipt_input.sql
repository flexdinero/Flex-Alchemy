BEGIN;
ALTER TABLE alchemy.mission_catalog_checks ADD COLUMN catalog_bytes bytea;
ALTER TABLE alchemy.mission_catalog_checks ADD CONSTRAINT catalog_bytes_match_receipt
CHECK (catalog_bytes IS NULL OR (
  octet_length(catalog_bytes) <= 1048576
  AND encode(sha256(catalog_bytes), 'hex') = catalog_sha256
));
COMMIT;
