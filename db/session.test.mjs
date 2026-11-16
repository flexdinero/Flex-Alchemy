import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('sessions resolve an actor until expiry or revocation', async () => {
  const db = new PGlite();
  try {
    for (const name of ['001_workspace_boundary.sql', '002_actor_identity.sql', '003_sessions.sql',
      '004_login_attempts.sql', '005_identity_cleanup.sql', '029_revoke_other_sessions.sql',
      '042_account_appearance.sql']) {
      await db.exec(await readFile(new URL('./migrations/' + name, import.meta.url), 'utf8'));
    }
    await db.exec('SET ROLE alchemy_identity');
    const { rows: [{ actor }] } = await db.query("SELECT alchemy.resolve_actor('https://issuer.example', 'subject') AS actor");
    const active = 'a'.repeat(64);
    const expired = 'b'.repeat(64);
    await db.query(`INSERT INTO alchemy.sessions (token_digest, actor_id, expires_at)
      VALUES ($1,$3,now() + interval '1 hour'), ($2,$3,now() - interval '1 hour')`, [active, expired, actor]);
    const lookup = async digest => (await db.query('SELECT alchemy.session_actor($1) AS actor', [digest])).rows[0].actor;
    assert.equal(await lookup(active), actor);
    assert.equal(await lookup(expired), null);
    await db.query(`INSERT INTO alchemy.login_attempts VALUES
      ($1, 'state', 'nonce', 'verifier', now() - interval '1 hour'),
      ($2, 'state', 'nonce', 'verifier', now() + interval '1 hour')`, [expired, active]);
    await db.query('SELECT alchemy.cleanup_expired_identity_records()');
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT token_digest FROM alchemy.sessions')).rows, [{ token_digest: active }]);
    assert.deepEqual((await db.query('SELECT handle_digest FROM alchemy.login_attempts')).rows, [{ handle_digest: active }]);
    await db.exec('SET ROLE alchemy_identity');
    await db.query('SELECT alchemy.revoke_session($1)', [active]);
    assert.equal(await lookup(active), null);
    const { sessionStore } = await import('./session-store.mjs');
    await db.exec('RESET ROLE');
    const pool = { connect: async () => ({ query: db.query.bind(db), release() {} }) };
    const sessions = sessionStore(pool);
    const token = await sessions.issue({ issuer: 'https://issuer.example', subject: 'subject' });
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(await sessions.actor(token), actor);
    const { hostedApi } = await import('../apps/hosted/api.mjs');
    const origin = 'https://alchemy.example';
    const handle = hostedApi({ pool, publicOrigin: origin });
    const cookie = '__Host-alchemy_session=' + token;
    const other = await sessions.issue({ issuer: 'https://issuer.example', subject: 'subject' });
    const unrelated = await sessions.issue({ issuer: 'https://issuer.example', subject: 'other-user' });
    const revokeOthers = headers => handle(new Request(origin + '/account/sessions/revoke-others', { method: 'POST', headers }));
    assert.equal((await revokeOthers({ origin })).status, 401);
    assert.equal((await revokeOthers({ origin: 'https://other.example', cookie })).status, 403);
    assert.equal(await sessions.actor(other), actor);
    const revoked = await revokeOthers({ origin, cookie });
    assert.equal(revoked.status, 200);
    assert.match(await revoked.text(), /Other Flex Alchemy sessions ended/);
    assert.equal(await sessions.actor(other), null);
    assert.equal(await sessions.actor(token), actor);
    assert.ok(await sessions.actor(unrelated));
    assert.equal((await revokeOthers({ origin, cookie: '__Host-alchemy_session=' + other })).status, 401);
    const signOut = headers => handle(new Request(origin + '/api/sign-out', { method: 'POST', headers }));
    assert.equal((await signOut({ origin, cookie: cookie + '; ' + cookie })).status, 401);
    assert.equal((await signOut({ origin: 'https://other.example', cookie })).status, 403);
    assert.equal(await sessions.actor(token), actor);
    const response = await signOut({ origin, cookie });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), '__Host-alchemy_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
    assert.equal(await sessions.actor(token), null);
    const repeated = await signOut({ origin, cookie });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.headers.get('set-cookie'), response.headers.get('set-cookie'));
  } finally {
    await db.close();
  }
});
