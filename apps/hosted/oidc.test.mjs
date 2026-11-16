import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import * as oidc from 'openid-client';
import { hostedApi } from './api.mjs';
import { oidcBrowserFlow } from './oidc.mjs';
import { sessionStore } from '../../db/session-store.mjs';

test('OIDC code flow binds browser state, PKCE and nonce before opening a session', async () => {
  const db = new PGlite();
  const pool = { async connect() {
    return { query: (sql, values) => db.query(sql, values), release() {} };
  } };
  const issuer = 'https://issuer.example';
  const publicOrigin = 'https://alchemy.example';
  const config = new oidc.Configuration({
    issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
    jwks_uri: issuer + '/jwks', prompt_values_supported: ['login', 'create'],
  }, 'alchemy-client', 'fixture-secret');
  const sessions = sessionStore(pool);
  const recoveryUrl = issuer + '/recover';
  const browserFlow = oidcBrowserFlow({ config, sessions, publicOrigin, recoveryUrl });
  const handle = hostedApi({ pool, publicOrigin, browserFlow });
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  let challenge;
  let nonce;
  let exchanges = 0;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  config[oidc.customFetch] = async (url, options) => {
    if (String(url) === issuer + '/jwks') {
      return Response.json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256' }] });
    }
    assert.equal(String(url), issuer + '/token');
    const fields = new URLSearchParams(options.body);
    assert.equal(fields.get('redirect_uri'), publicOrigin + '/auth/callback');
    assert.equal(await oidc.calculatePKCECodeChallenge(fields.get('code_verifier')), challenge);
    exchanges++;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = encode({ alg: 'RS256', kid: 'fixture' }) + '.' + encode({
      iss: issuer, sub: 'verified-subject', aud: 'alchemy-client', iat: now, exp: now + 300,
      nonce: fields.get('code') === 'bad-nonce' ? 'wrong-nonce' : nonce,
    });
    const signature = sign('RSA-SHA256', Buffer.from(
      fields.get('code') === 'bad-signature' ? unsigned + 'changed' : unsigned,
    ), privateKey).toString('base64url');
    return Response.json({ access_token: 'fixture-access-token', token_type: 'Bearer', id_token: unsigned + '.' + signature });
  };
  async function begin(path = '/auth/sign-in', prompt = null) {
    const response = await handle(new Request(new URL(path, publicOrigin)));
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get('location'));
    assert.equal(location.searchParams.has('return'), false);
    assert.equal(location.searchParams.get('prompt'), prompt);
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    challenge = location.searchParams.get('code_challenge');
    nonce = location.searchParams.get('nonce');
    return { state: location.searchParams.get('state'), cookie: response.headers.get('set-cookie').split(';')[0] };
  }
  function callback(attempt, state = attempt.state, code = 'valid-code') {
    return handle(new Request(publicOrigin + '/auth/callback?' + new URLSearchParams({ code, state }), {
      headers: { Cookie: attempt.cookie },
    }));
  }
  try {
    for (const name of ['001_workspace_boundary.sql', '002_actor_identity.sql', '003_sessions.sql',
      '004_login_attempts.sql', '031_login_return_path.sql']) {
      await db.exec(await readFile(new URL('../../db/migrations/' + name, import.meta.url), 'utf8'));
    }
    const attempt = await begin();
    const entry = await handle(new Request(publicOrigin + '/'));
    assert.equal(entry.status, 200);
    const entryContent = await entry.text();
    assert.match(entryContent, /href="\/auth\/sign-in"/);
    assert.match(entryContent, /href="\/sign-up"/);
    const recovery = await handle(new Request(publicOrigin + '/forgot-password?return=https://evil.example'));
    assert.equal(recovery.status, 303);
    assert.equal(recovery.headers.get('location'), recoveryUrl);
    const rejected = await callback(attempt, 'a'.repeat(43));
    assert.equal(rejected.status, 400);
    assert.match(rejected.headers.get('content-type'), /text\/html/);
    assert.equal(rejected.headers.get('referrer-policy'), 'no-referrer');
    const retryPage = await rejected.text();
    assert.match(retryPage, /href="\/auth\/sign-in"/);
    assert.match(retryPage, /href="\/access-help"/);
    assert.doesNotMatch(retryPage, /valid-code/);
    assert.equal(exchanges, 0);
    const complete = await callback(attempt);
    assert.equal(complete.status, 303);
    const cookies = complete.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.match(cookies[0], /Secure; HttpOnly; SameSite=Lax/);
    const landing = await handle(new Request(new URL(complete.headers.get('location'), publicOrigin), {
      headers: { Cookie: cookies[0].split(';')[0] },
    }));
    assert.equal(landing.status, 200);
    assert.match(await landing.text(), /No workspaces available/);
    const response = await handle(new Request(publicOrigin + '/api/workspaces', {
      headers: { Cookie: cookies[0].split(';')[0] },
    }));
    assert.equal(response.status, 200);
    assert.equal((await callback(attempt)).status, 400);
    assert.equal(exchanges, 1);
    assert.equal((await callback(await begin(), undefined, 'bad-nonce')).status, 400);
    assert.equal(exchanges, 2);
    assert.equal((await callback(await begin(), undefined, 'bad-signature')).status, 400);
    assert.equal(exchanges, 3);
    const deepLink = '/workspaces/00000000-0000-4000-8000-000000000001/knowledge?q=testing';
    const redirect = await handle(new Request(publicOrigin + deepLink));
    assert.equal(redirect.status, 303);
    const comeback = await callback(await begin(redirect.headers.get('location')));
    assert.equal(comeback.headers.get('location'), deepLink);
    const denied = await handle(new Request(publicOrigin + deepLink, {
      headers: { Cookie: comeback.headers.getSetCookie()[0].split(';')[0] },
    }));
    assert.equal(denied.status, 404);
    const invitation = '/invite/00000000-0000-4000-8000-000000000002';
    const invitationRedirect = await handle(new Request(publicOrigin + invitation));
    assert.equal(invitationRedirect.status, 303);
    assert.equal((await callback(await begin(invitationRedirect.headers.get('location')))).headers.get('location'), invitation);
    const registration = await begin('/sign-up?' + new URLSearchParams({ return: invitation }), 'create');
    assert.equal((await callback(registration)).headers.get('location'), invitation);
    const unsupported = new oidc.Configuration({ issuer, authorization_endpoint: issuer + '/authorize',
      token_endpoint: issuer + '/token', jwks_uri: issuer + '/jwks' }, 'alchemy-client', 'fixture-secret');
    const unavailableFlow = oidcBrowserFlow({ config: unsupported, sessions, publicOrigin });
    assert.equal(await unavailableFlow(new Request(publicOrigin + '/sign-up')), null);
    assert.equal(await unavailableFlow(new Request(publicOrigin + '/forgot-password')), null);
    for (const returnPath of ['//evil.example', '//', '/\\evil.example', '/workspaces/../auth/sign-out', 'https://evil.example']) {
      const externalAttempt = await begin('/auth/sign-in?' + new URLSearchParams({ return: returnPath }));
      assert.equal((await callback(externalAttempt)).headers.get('location'), '/');
    }
  } finally {
    await db.close();
  }
});
