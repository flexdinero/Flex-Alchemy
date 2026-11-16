import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const directory = new URL('./migrations/', import.meta.url);

export async function readMigrations() {
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  if (!names.length) throw new Error('No database migrations found');
  return Promise.all(names.map(async (name, index) => {
    if (!name.startsWith(String(index + 1).padStart(3, '0') + '_')) {
      throw new Error('Database migration numbering is invalid: ' + name);
    }
    const source = (await readFile(new URL(name, directory), 'utf8')).replaceAll('\r\n', '\n').trim();
    const body = /^BEGIN;\n([\s\S]+)\nCOMMIT;$/i.exec(source)?.[1];
    if (!body) throw new Error('Expected a transaction wrapper in ' + name);
    return { name, body, checksum: createHash('sha256').update(source).digest('hex') };
  }));
}

export async function migrate(client, migrations) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(460317, 1)');
    const { rows: [state] } = await client.query(
      "SELECT to_regnamespace('alchemy') AS existing_schema, to_regclass('alchemy.schema_migrations') AS ledger"
    );
    if (state.existing_schema && !state.ledger) {
      throw new Error('Existing alchemy schema has no migration history. Verify its provenance before migration.');
    }
    const applied = state.ledger
      ? (await client.query('SELECT name, checksum FROM alchemy.schema_migrations ORDER BY name')).rows
      : [];
    for (const [index, entry] of applied.entries()) {
      const expected = migrations[index];
      if (entry.name !== expected?.name || entry.checksum !== expected.checksum) {
        throw new Error('Database migration history differs at ' + entry.name);
      }
    }
    const pending = migrations.slice(applied.length);
    for (const [index, migration] of pending.entries()) {
      await client.query(migration.body);
      if (!state.ledger && index === 0) {
        await client.query(`CREATE TABLE alchemy.schema_migrations (
          name text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`);
      }
      await client.query('INSERT INTO alchemy.schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, migration.checksum]);
    }
    await client.query('COMMIT');
    return pending.map(migration => migration.name);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const connectionString = process.env.ALCHEMY_MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('ALCHEMY_MIGRATION_DATABASE_URL is required');
  const migrations = await readMigrations();
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    const applied = await migrate(client, migrations);
    console.log(applied.length ? 'Applied ' + applied.join(', ') : 'Database migrations are current');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  });
}
