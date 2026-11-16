import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { migrate, readMigrations } from './migrate.mjs';

test('hosted migrations roll back on failure, record success, and reject drift', async () => {
  const database = new PGlite();
  try {
    const client = {
      query: (sql, params) => params ? database.query(sql, params) : database.exec(sql).then(results => results[0]),
    };
    const migrations = await readMigrations();
    await assert.rejects(migrate(client, [...migrations, {
      name: '010_invalid.sql', body: 'SELECT missing_column', checksum: 'invalid',
    }]), /missing_column/);
    assert.deepEqual(await migrate(client, migrations), migrations.map(({ name }) => name));
    assert.deepEqual(await migrate(client, migrations), []);
    await assert.rejects(migrate(client, [{ ...migrations[0], checksum: 'changed' }, ...migrations.slice(1)]),
      /history differs at 001_workspace_boundary.sql/);
    await database.exec('DROP TABLE alchemy.schema_migrations');
    await assert.rejects(migrate(client, migrations), /schema has no migration history/);
  } finally {
    await database.close();
  }
});
