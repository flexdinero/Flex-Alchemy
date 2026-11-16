import { createHash, randomBytes } from 'node:crypto';

const digest = token => createHash('sha256').update(token).digest('hex');
const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

export function sessionStore(pool) {
  async function identityQuery(callback) {
    const client = await pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE alchemy_identity');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  return {
    cleanupExpired() {
      return identityQuery(client => client.query('SELECT alchemy.cleanup_expired_identity_records()'));
    },
    beginLogin({ state, nonce, verifier, returnPath = '/' }) {
      const handle = randomBytes(32).toString('base64url');
      return identityQuery(async client => {
        await client.query(`INSERT INTO alchemy.login_attempts (handle_digest, state, nonce, verifier, expires_at, return_path)
          VALUES ($1, $2, $3, $4, statement_timestamp() + interval '10 minutes', $5)`,
        [digest(handle), state, nonce, verifier, returnPath]);
        return handle;
      });
    },
    consumeLogin(handle, state) {
      if (!validToken(handle) || typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
        return Promise.resolve(null);
      }
      return identityQuery(async client => (
        await client.query('SELECT * FROM alchemy.consume_login_attempt($1, $2)', [digest(handle), state])
      ).rows[0] ?? null);
    },
    // The caller supplies issuer and subject only after validating an identity-provider response.
    issue({ issuer, subject }) {
      if (!issuer || !subject) throw new TypeError('Verified issuer and subject are required');
      const token = randomBytes(32).toString('base64url');
      return identityQuery(async client => {
        const { rows: [{ actor }] } = await client.query(
          'SELECT alchemy.resolve_actor($1, $2) AS actor', [issuer, subject],
        );
        await client.query(`INSERT INTO alchemy.sessions (token_digest, actor_id, expires_at)
          VALUES ($1, $2, statement_timestamp() + interval '8 hours')`, [digest(token), actor]);
        return token;
      });
    },
    actor(token) {
      if (!validToken(token)) return Promise.resolve(null);
      return identityQuery(async client => (
        await client.query('SELECT alchemy.session_actor($1) AS actor', [digest(token)])
      ).rows[0].actor);
    },
    revoke(token) {
      if (!validToken(token)) return Promise.resolve();
      return identityQuery(client => client.query('SELECT alchemy.revoke_session($1)', [digest(token)]));
    },
    revokeOthers(token) {
      if (!validToken(token)) return Promise.resolve(false);
      return identityQuery(async client => (
        await client.query('SELECT alchemy.revoke_other_sessions($1) AS authorized', [digest(token)])
      ).rows[0].authorized);
    },
  };
}
