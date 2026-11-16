import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { checkDatabase } from './check-database.mjs';

const directory = new URL('./migrations/', import.meta.url);
const migrations = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.sql')).sort()
  .map(name => readFile(new URL(name, directory), 'utf8')));

for (const scenario of ['restricted login', 'unforced row security', 'missing draft delete grant', 'missing identity role']) {
  test('deployment preflight: ' + scenario, async () => {
    const db = new PGlite();
    const pool = { async connect() {
      return { query: (sql, params) => db.query(sql, params), release(discard) { assert.equal(discard, false); } };
    } };
    try {
      for (const migration of migrations) await db.exec(migration);
      await assert.rejects(checkDatabase(pool), /service login must be restricted/);
      await db.exec(`CREATE ROLE alchemy_test_login LOGIN NOINHERIT;
        GRANT alchemy_app TO alchemy_test_login;
        INSERT INTO alchemy.workspaces VALUES ('00000000-0000-4000-8000-000000000001', 'Private');`);
      if (scenario !== 'missing identity role') await db.exec('GRANT alchemy_identity TO alchemy_test_login');
      if (scenario === 'unforced row security') await db.exec('ALTER TABLE alchemy.missions NO FORCE ROW LEVEL SECURITY');
      if (scenario === 'missing draft delete grant') await db.exec('REVOKE DELETE ON alchemy.mission_drafts FROM alchemy_app');
      await db.exec('SET SESSION AUTHORIZATION alchemy_test_login');
      if (scenario === 'restricted login') {
        await checkDatabase(pool);
        assert.equal((await db.query('SELECT current_user AS name')).rows[0].name, 'alchemy_test_login');
      } else if (scenario === 'unforced row security' || scenario === 'missing draft delete grant') {
        await assert.rejects(checkDatabase(pool), /Workspace schema or runtime role is incomplete/);
      } else await assert.rejects(checkDatabase(pool), { code: '42501' });
    } finally {
      await db.close();
    }
  });
}
