import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { sessionStore } from './session-store.mjs';

test('a sign-in attempt can be consumed once by the browser that started it', async () => {
  const db = new PGlite();
  try {
    for (const migration of ['001_workspace_boundary', '002_actor_identity', '004_login_attempts', '031_login_return_path']) {
      await db.exec(await readFile(new URL(`./migrations/${migration}.sql`, import.meta.url), 'utf8'));
    }
    const sessions = sessionStore({ connect: async () => ({ query: db.query.bind(db), release() {} }) });
    const state = 's'.repeat(43);
    const verifier = 'v'.repeat(43);
    const nonce = 'n'.repeat(43);
    const returnPath = '/account';
    const handle = await sessions.beginLogin({ state, verifier, nonce, returnPath });
    const otherHandle = await sessions.beginLogin({ state: 't'.repeat(43), verifier, nonce });
    assert.equal(await sessions.consumeLogin(otherHandle, state), null);
    assert.deepEqual(await sessions.consumeLogin(handle, state), { verifier, nonce, return_path: returnPath });
    assert.equal(await sessions.consumeLogin(handle, state), null);
    await db.exec("UPDATE alchemy.login_attempts SET expires_at = statement_timestamp() - interval '1 second'");
    assert.equal(await sessions.consumeLogin(otherHandle, 't'.repeat(43)), null);
  } finally {
    await db.close();
  }
});
