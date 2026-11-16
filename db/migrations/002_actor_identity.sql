BEGIN;

CREATE ROLE alchemy_identity NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA alchemy TO alchemy_identity;

CREATE TABLE alchemy.actor_identities (
  issuer text COLLATE "C" NOT NULL CHECK (length(issuer) BETWEEN 1 AND 1000),
  subject text COLLATE "C" NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  actor_id uuid NOT NULL UNIQUE DEFAULT pg_catalog.gen_random_uuid(),
  PRIMARY KEY (issuer, subject)
);
REVOKE ALL ON alchemy.actor_identities FROM PUBLIC;

-- Only the trusted identity service may submit claims verified by its OIDC client.
CREATE FUNCTION alchemy.resolve_actor(verified_issuer text, verified_subject text)
RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  INSERT INTO alchemy.actor_identities AS identity (issuer, subject)
  VALUES (verified_issuer, verified_subject)
  ON CONFLICT (issuer, subject) DO UPDATE SET subject = EXCLUDED.subject
  RETURNING identity.actor_id
$$;
REVOKE ALL ON FUNCTION alchemy.resolve_actor(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alchemy.resolve_actor(text, text) TO alchemy_identity;

COMMIT;
