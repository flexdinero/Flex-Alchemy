BEGIN;

CREATE INDEX sessions_actor_id ON alchemy.sessions (actor_id);

CREATE FUNCTION alchemy.revoke_other_sessions(digest text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  WITH current_session AS MATERIALIZED (
    SELECT actor_id FROM alchemy.sessions
    WHERE token_digest = digest AND expires_at > statement_timestamp()
  ), revoked AS (
    DELETE FROM alchemy.sessions
    USING current_session
    WHERE sessions.actor_id = current_session.actor_id AND sessions.token_digest <> digest
  )
  SELECT EXISTS (SELECT 1 FROM current_session)
$$;

REVOKE ALL ON FUNCTION alchemy.revoke_other_sessions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alchemy.revoke_other_sessions(text) TO alchemy_identity;

COMMIT;
