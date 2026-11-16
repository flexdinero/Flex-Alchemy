import pg from 'pg';
import { hostedApi } from './api.mjs';
import { discoverBrowserFlow } from './oidc.mjs';
import { hostedHttpServer } from './http.mjs';
import { sessionStore } from '../../db/session-store.mjs';
import { checkDatabase } from '../../db/check-database.mjs';

const { DATABASE_URL, ALCHEMY_PUBLIC_ORIGIN, OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET } = process.env;
const port = Number(process.env.PORT ?? 4174);
let pool;
let startupStage = 'configuration';
try {
  const db = new URL(DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) ||
      [...db.searchParams.keys()].some(key => /^ssl/i.test(key))) {
    throw new Error('Use a PostgreSQL URL without SSL options');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  const publicOrigin = ALCHEMY_PUBLIC_ORIGIN;
  const origin = new URL(publicOrigin);
  const issuer = new URL(OIDC_ISSUER);
  if (origin.protocol !== 'https:' || origin.origin !== publicOrigin ||
      issuer.protocol !== 'https:' || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET) {
    throw new Error('Invalid identity or public origin configuration');
  }
  startupStage = 'PostgreSQL preflight';
  pool = new pg.Pool({
    connectionString: DATABASE_URL, ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000, statement_timeout: 10_000, query_timeout: 12_000,
  });
  pool.on('error', () => console.error('Idle database connection failed'));
  await checkDatabase(pool);
  startupStage = 'OIDC discovery';
  const sessions = sessionStore(pool);
  const browserFlow = await discoverBrowserFlow({
    issuer: OIDC_ISSUER, clientId: OIDC_CLIENT_ID, clientSecret: OIDC_CLIENT_SECRET,
    sessions, publicOrigin,
  });
  startupStage = 'HTTP setup';
  const api = hostedApi({ pool, publicOrigin, browserFlow });
  const server = hostedHttpServer({ handle: api, publicOrigin, async checkReady() {
    if (stopping) return false;
    await pool.query('SELECT 1');
    return !stopping;
  } });
  let stopping = false;
  function shutdown(exitCode) {
    if (stopping) return;
    stopping = true;
    process.exitCode = exitCode;
    const deadline = setTimeout(() => {
      console.error('Hosted shutdown exceeded its deadline');
      server.closeAllConnections();
      process.exit(1);
    }, 30_000);
    server.close(async () => {
      try { await pool.end(); }
      catch { process.exitCode = 1; }
      finally { clearTimeout(deadline); }
    });
  }
  server.once('error', () => {
    console.error('Hosted listener failed');
    shutdown(1);
  });
  let cleaning = false;
  async function cleanup() {
    if (cleaning) return;
    cleaning = true;
    try { await sessions.cleanupExpired(); }
    catch { console.error('Expired identity record cleanup failed'); }
    finally { cleaning = false; }
  }
  server.listen(port, '127.0.0.1', () => {
    console.log('Hosted workspace listening on loopback port ' + port);
    void cleanup();
    const timer = setInterval(cleanup, 3_600_000);
    timer.unref();
    server.once('close', () => clearInterval(timer));
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => shutdown(0));
  }
} catch {
  console.error('Hosted startup failed during ' + startupStage + '.');
  if (pool) await pool.end();
  process.exitCode = 1;
}
