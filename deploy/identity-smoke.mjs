import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const temp = resolve(tmpdir());
const dir = mkdtempSync(join(temp, 'alchemy-oidc-smoke-'));
const namespace = 'alchemy-oidc-' + randomUUID().slice(0, 8);
const keycloak = namespace + '-idp';
const database = namespace + '-postgres';
const edge = namespace + '-proxy';
const app = namespace + '-app';
const password = randomUUID();
const clientSecret = randomUUID();
const keycloakImage = 'quay.io/keycloak/keycloak@sha256:c68e286cacd87b942ac1939a0a1481461109d6acd3a57dc496969a319a76bbf0';
const proxyImage = 'caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0';
const argumentsList = process.argv.slice(2);
const image = argumentsList.find(argument => !argument.startsWith('--')) ?? 'flex-alchemy:staging';

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { timeout: 90_000, maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.status !== 0) {
    const detail = result.stderr?.toString().replaceAll(password, '[redacted]').replaceAll(clientSecret, '[redacted]');
    throw new Error('Docker ' + args[0] + ' failed: ' + (detail || result.error?.message || result.status));
  }
  return result.stdout;
}

function psql(sql) {
  return docker(['exec', '-i', database, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], { input: sql });
}

async function eventually(check, description) {
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      const result = await check();
      if (result) return result;
    } catch {
      // Services may be starting or reloading.
    }
    await delay(500);
  }
  throw new Error('Timed out awaiting ' + description);
}

function exchange(address, ca, cookies = new Map(), fields) {
  const url = new URL(address);
  const body = fields ? new URLSearchParams(fields).toString() : null;
  return new Promise((resolve, reject) => {
    const headers = { Host: url.host };
    const jar = cookies.get(url.origin);
    if (jar?.size) headers.Cookie = Array.from(jar, ([name, value]) => name + '=' + value).join('; ');
    if (body !== null) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(body);
      headers.Origin = url.origin;
    }
    const request = https.request({ hostname: '127.0.0.1', port: url.port, servername: url.hostname,
      path: url.pathname + url.search, method: body === null ? 'GET' : 'POST', headers, ca, timeout: 5000 }, response => {
      const responseJar = jar ?? new Map();
      for (const setCookie of response.headers['set-cookie'] ?? []) {
        const first = setCookie.split(';')[0];
        const separator = first.indexOf('=');
        const name = first.slice(0, separator);
        const value = first.slice(separator + 1);
        if (value) responseJar.set(name, value);
        else responseJar.delete(name);
      }
      cookies.set(url.origin, responseJar);
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location,
        cookies: response.headers['set-cookie'] ?? [], body: Buffer.concat(chunks).toString() }));
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('HTTPS request timed out')));
    request.end(body);
  });
}

async function login(origin, ca, username) {
  const cookies = new Map();
  const start = await exchange(origin + '/auth/sign-in', ca, cookies);
  assert.equal(start.status, 303);
  const authorization = await exchange(start.location, ca, cookies);
  assert.equal(authorization.status, 200);
  const formAction = authorization.body.match(/<form\b[^>]*\bid="kc-form-login"[^>]*\baction="([^"]+)"/)?.[1];
  assert.ok(formAction, 'Keycloak served its login form');
  const action = new URL(formAction.replaceAll('&amp;', '&'), start.location);
  assert.equal(action.origin, new URL(start.location).origin);
  const submitted = await exchange(action, ca, cookies, { username, password });
  assert.equal(submitted.status, 302);
  const callback = await exchange(submitted.location, ca, cookies);
  assert.equal(callback.status, 303);
  assert.ok(callback.cookies.some(cookie => /^__Host-alchemy_session=.+; Path=\/; Secure; HttpOnly; SameSite=Lax/.test(cookie)));
  return cookies;
}

try {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = 'https://app.alchemy.test:' + port;
  const identityOrigin = 'https://login.alchemy.test:' + port;
  const issuer = identityOrigin + '/realms/flex-alchemy';
  const caddyfile = join(dir, 'Caddyfile');
  const realm = join(dir, 'flex-alchemy-realm.json');
  writeFileSync(caddyfile, '{\n  admin off\n}\n' + origin + ' {\n  tls internal\n  reverse_proxy app:4174\n}\n' +
    identityOrigin + ' {\n  tls internal\n  reverse_proxy keycloak:8080\n}\n');
  writeFileSync(realm, JSON.stringify({
    realm: 'flex-alchemy', enabled: true,
    clients: [{ clientId: 'alchemy', secret: clientSecret, enabled: true, standardFlowEnabled: true,
      publicClient: false, redirectUris: [origin + '/auth/callback'] }],
    users: ['founder', 'outsider'].map(username => ({ username, enabled: true, emailVerified: true, firstName: 'Smoke',
      lastName: 'Test', email: username + '@example.test', credentials: [{ type: 'password', value: password, temporary: false }] })),
  }));
  docker(['network', 'create', namespace]);
  docker(['run', '-d', '--rm', '--name', edge, '--network', namespace, '--network-alias', 'login.alchemy.test',
    '-p', '127.0.0.1:' + port + ':' + port, '--mount', 'type=bind,source=' + caddyfile + ',target=/etc/caddy/Caddyfile,readonly', proxyImage]);
  docker(['run', '-d', '--rm', '--name', keycloak, '--network', namespace, '--network-alias', 'keycloak',
    '--mount', 'type=bind,source=' + realm + ',target=/opt/keycloak/data/import/flex-alchemy-realm.json,readonly',
    keycloakImage, 'start-dev', '--hostname=' + identityOrigin, '--proxy-headers=xforwarded', '--import-realm']);
  docker(['run', '-d', '--rm', '--name', database, '--network', namespace, '--network-alias', 'pg.alchemy.test',
    '-e', 'POSTGRES_PASSWORD', 'pgvector/pgvector:pg17'], { env: { ...process.env, POSTGRES_PASSWORD: password } });
  await eventually(() => docker(['exec', database, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']), 'PostgreSQL');
  docker(['exec', '-u', 'postgres', database, 'openssl', 'req', '-x509', '-nodes', '-newkey', 'rsa:2048',
    '-keyout', '/tmp/alchemy.key', '-out', '/tmp/alchemy.crt', '-days', '1', '-subj', '/CN=pg.alchemy.test',
    '-addext', 'subjectAltName=DNS:pg.alchemy.test']);
  docker(['exec', '-u', 'postgres', database, 'chmod', '600', '/tmp/alchemy.key']);
  psql("ALTER SYSTEM SET ssl_cert_file='/tmp/alchemy.crt'; ALTER SYSTEM SET ssl_key_file='/tmp/alchemy.key'; ALTER SYSTEM SET ssl='on'; SELECT pg_reload_conf();");
  await eventually(() => psql('SHOW ssl;').toString().trim() === 'on', 'PostgreSQL TLS');
  for (const name of readdirSync(join(repository, 'db', 'migrations')).filter(name => name.endsWith('.sql')).sort()) {
    psql(readFileSync(join(repository, 'db', 'migrations', name)));
  }
  psql("CREATE ROLE alchemy_smoke LOGIN NOINHERIT PASSWORD '" + password + "';" +
    'GRANT alchemy_app TO alchemy_smoke WITH INHERIT FALSE, SET TRUE;' +
    'GRANT alchemy_identity TO alchemy_smoke WITH INHERIT FALSE, SET TRUE;');
  const cert = await eventually(() => docker(['exec', edge, 'cat', '/data/caddy/pki/authorities/local/root.crt']), 'proxy certificate');
  await eventually(async () => (await exchange(issuer + '/.well-known/openid-configuration', cert)).status === 200, 'Keycloak discovery');
  console.log('PostgreSQL TLS and Keycloak discovery are ready.');
  const trust = join(dir, 'runtime-ca.pem');
  writeFileSync(trust, Buffer.concat([cert, docker(['exec', database, 'cat', '/tmp/alchemy.crt'])]));
  docker(['run', '-d', '--rm', '--name', app, '--network', namespace, '--network-alias', 'app',
    '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--mount', 'type=bind,source=' + trust + ',target=/runtime-ca.pem,readonly', '-e', 'NODE_EXTRA_CA_CERTS=/runtime-ca.pem',
    '-e', 'DATABASE_URL', '-e', 'ALCHEMY_PUBLIC_ORIGIN', '-e', 'OIDC_ISSUER', '-e', 'OIDC_CLIENT_ID=alchemy',
    '-e', 'OIDC_CLIENT_SECRET', image],
  { env: { ...process.env, DATABASE_URL: 'postgresql://alchemy_smoke:' + password + '@pg.alchemy.test/postgres',
    ALCHEMY_PUBLIC_ORIGIN: origin, OIDC_ISSUER: issuer, OIDC_CLIENT_SECRET: clientSecret } });
  await eventually(async () => (await exchange(origin + '/health/ready', cert)).status === 200, 'Flex Alchemy readiness');
  const founder = await login(origin, cert, 'founder');
  const outsider = await login(origin, cert, 'outsider');
  const form = await exchange(origin + '/workspaces/new', cert, founder);
  const requestId = form.body.match(/name="request" value="([^"]+)"/)?.[1];
  assert.ok(requestId);
  const created = await exchange(origin + '/workspaces/new', cert, founder, { request: requestId, name: 'OIDC staging workspace' });
  assert.equal(created.status, 303);
  const workspace = origin + created.location;
  assert.match((await exchange(workspace, cert, founder)).body, /OIDC staging workspace/);
  assert.equal((await exchange(workspace, cert, outsider)).status, 404);
  assert.equal((await exchange(origin + '/sign-out', cert, founder, {})).status, 303);
  assert.equal((await exchange(workspace, cert, founder)).status, 303);
  console.log('TLS proxy, real Keycloak sign-in, workspace creation, tenant denial, and sign-out passed.');
  if (argumentsList.includes('--browser')) {
    const { checkIdentityBrowser } = await import('./browser-smoke.mjs');
    await checkIdentityBrowser({ origin, identityOrigin, ca: cert, password });
  }
} finally {
  for (const container of [app, keycloak, database, edge]) spawnSync('docker', ['stop', container], { timeout: 10_000 });
  spawnSync('docker', ['network', 'rm', namespace], { timeout: 10_000 });
  if (dirname(dir) === temp) rmSync(dir, { recursive: true, force: true });
}
