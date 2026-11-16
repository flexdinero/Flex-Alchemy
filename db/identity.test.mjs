import { provisionWorkspace } from './provision-workspace.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('verified issuer and subject resolve to a stable actor and workspace provisioning binds ownership to that identity', async () => {
  const db = new PGlite();
  try {
    for (const name of ['001_workspace_boundary.sql', '002_actor_identity.sql']) {
      await db.exec(await readFile(new URL('./migrations/' + name, import.meta.url), 'utf8'));
    }
    await db.exec('SET ROLE alchemy_identity');
    const resolve = async issuer => (await db.query(
      'SELECT alchemy.resolve_actor($1, $2) AS actor', [issuer, 'same-subject'],
    )).rows[0].actor;
    const actor = await resolve('https://identity.example');
    assert.equal(await resolve('https://identity.example'), actor);
    assert.notEqual(await resolve('https://another.example'), actor);
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT actor_id FROM alchemy.memberships')).rows, []);
    const input = {
      workspaceId: 'd8375ca9-5ec9-4152-b0d5-384453455901', name: 'Founder workspace',
      issuer: 'https://identity.example', subject: 'same-subject',
    };
    await assert.rejects(provisionWorkspace(db, { ...input, subject: 'unknown' }), /no verified identity/);
    assert.deepEqual((await db.query('SELECT id FROM alchemy.workspaces')).rows, []);
    assert.equal(await provisionWorkspace(db, input), true);
    assert.equal(await provisionWorkspace(db, input), false);
    await assert.rejects(provisionWorkspace(db, { ...input, issuer: 'https://another.example' }), /different settings or ownership/);
    await db.exec('SET ROLE alchemy_app');
    await db.query("SELECT set_config('alchemy.actor_id', $1, false)", [actor]);
    assert.deepEqual((await db.query('SELECT id, name FROM alchemy.workspaces')).rows, [
      { id: input.workspaceId, name: input.name },
    ]);
    await db.exec('RESET ROLE');
    await db.exec('UPDATE alchemy.memberships SET revoked_at = now()');
    await assert.rejects(provisionWorkspace(db, input), /different settings or ownership/);
  } finally {
    await db.close();
  }
});
