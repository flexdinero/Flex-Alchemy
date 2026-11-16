BEGIN;
CREATE TABLE alchemy.account_appearance (
  actor_id uuid PRIMARY KEY REFERENCES alchemy.actor_identities(actor_id),
  theme text NOT NULL CHECK (theme IN ('dark','light','system')),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE alchemy.account_appearance ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.account_appearance FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT (actor_id, theme), UPDATE (theme, updated_at), DELETE
  ON alchemy.account_appearance TO alchemy_app;
CREATE POLICY own_appearance ON alchemy.account_appearance TO alchemy_app
USING (actor_id = alchemy.actor_id()) WITH CHECK (actor_id = alchemy.actor_id());
COMMIT;
