BEGIN;
CREATE TABLE alchemy.login_attempts (
  handle_digest text PRIMARY KEY CHECK (handle_digest ~ '^[0-9a-f]{64}$'),
  state text NOT NULL,
  nonce text NOT NULL,
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);
REVOKE ALL ON alchemy.login_attempts FROM PUBLIC;
GRANT INSERT ON alchemy.login_attempts TO alchemy_identity;

CREATE FUNCTION alchemy.consume_login_attempt(digest text, expected_state text)
RETURNS TABLE(nonce text, verifier text)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  DELETE FROM alchemy.login_attempts
  WHERE handle_digest = digest AND state = expected_state
  AND expires_at > statement_timestamp()
  RETURNING login_attempts.nonce, login_attempts.verifier
$$;
REVOKE ALL ON FUNCTION alchemy.consume_login_attempt(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alchemy.consume_login_attempt(text, text) TO alchemy_identity;
COMMIT;
