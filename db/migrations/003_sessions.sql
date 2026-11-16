BEGIN;

CREATE TABLE alchemy.sessions (
  token_digest text COLLATE "C" PRIMARY KEY CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  actor_id uuid NOT NULL REFERENCES alchemy.actor_identities(actor_id),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON alchemy.sessions (expires_at);
REVOKE ALL ON alchemy.sessions FROM PUBLIC;
GRANT INSERT ON alchemy.sessions TO alchemy_identity;

CREATE FUNCTION alchemy.session_actor(digest text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT actor_id FROM alchemy.sessions
  WHERE token_digest = digest AND expires_at > statement_timestamp()
$$;

CREATE FUNCTION alchemy.revoke_session(digest text) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  DELETE FROM alchemy.sessions WHERE token_digest = digest
$$;

REVOKE ALL ON FUNCTION alchemy.session_actor(text), alchemy.revoke_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alchemy.session_actor(text), alchemy.revoke_session(text) TO alchemy_identity;

COMMIT;
