BEGIN;
ALTER TABLE alchemy.login_attempts
  ADD COLUMN return_path text NOT NULL DEFAULT '/' CHECK (length(return_path) BETWEEN 1 AND 2048);

DROP FUNCTION alchemy.consume_login_attempt(text, text);
CREATE FUNCTION alchemy.consume_login_attempt(digest text, expected_state text)
RETURNS TABLE(nonce text, verifier text, return_path text)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  DELETE FROM alchemy.login_attempts
  WHERE handle_digest = digest AND state = expected_state
  AND expires_at > statement_timestamp()
  RETURNING login_attempts.nonce, login_attempts.verifier, login_attempts.return_path
$$;
REVOKE ALL ON FUNCTION alchemy.consume_login_attempt(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alchemy.consume_login_attempt(text, text) TO alchemy_identity;
COMMIT;
