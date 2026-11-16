import { pathToFileURL } from 'node:url';
import pg from 'pg';

export async function provisionWorkspace(client, { workspaceId, name, issuer, subject }) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(workspaceId ?? '') ||
      !name?.trim() || name.trim().length > 100 || !issuer || !subject) {
    throw new Error('Supply a workspace UUID, name (1–100 characters), and the exact verified OIDC issuer and subject');
  }
  const workspaceName = name.trim();
  await client.query('BEGIN');
  try {
    const { rows: [identity] } = await client.query(
      'SELECT actor_id FROM alchemy.actor_identities WHERE issuer = $1 AND subject = $2', [issuer, subject]);
    if (!identity) throw new Error('Account has no verified identity in this database. Have the founder sign in first.');
    const { rows: [created] } = await client.query(
      'INSERT INTO alchemy.workspaces (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [workspaceId, workspaceName]);
    if (created) {
      await client.query("INSERT INTO alchemy.memberships (workspace_id, actor_id, role) VALUES ($1, $2, 'owner')",
        [workspaceId, identity.actor_id]);
    } else {
      const { rows: [existing] } = await client.query(`SELECT w.name, m.role, m.revoked_at
        FROM alchemy.workspaces w LEFT JOIN alchemy.memberships m ON m.workspace_id = w.id AND m.actor_id = $2
        WHERE w.id = $1 FOR SHARE OF w`, [workspaceId, identity.actor_id]);
      if (existing?.name !== workspaceName || existing.role !== 'owner' || existing.revoked_at !== null) {
        throw new Error('Workspace already exists with different settings or ownership');
      }
    }
    await client.query('COMMIT');
    return Boolean(created);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const connectionString = process.env.ALCHEMY_MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('ALCHEMY_MIGRATION_DATABASE_URL is required');
  const [workspaceId, name, issuer, subject, extra] = process.argv.slice(2);
  if (extra !== undefined) throw new Error('Expected four arguments');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    const created = await provisionWorkspace(client, { workspaceId, name, issuer, subject });
    console.log(created ? 'Workspace and owner created' : 'Workspace and owner already provisioned');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('Workspace provisioning failed:', error.message);
    process.exitCode = 1;
  });
}
