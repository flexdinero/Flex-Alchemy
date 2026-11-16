BEGIN;

CREATE INDEX login_attempts_expiry ON alchemy.login_attempts (expires_at);
CREATE FUNCTION alchemy.cleanup_expired_identity_records() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  DELETE FROM alchemy.login_attempts WHERE expires_at <= statement_timestamp();
  DELETE FROM alchemy.sessions WHERE expires_at <= statement_timestamp();
END;
$$;
REVOKE ALL ON FUNCTION alchemy.cleanup_expired_identity_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alchemy.cleanup_expired_identity_records() TO alchemy_identity;

COMMIT;
