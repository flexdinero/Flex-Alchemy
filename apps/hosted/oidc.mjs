import * as oidc from 'openid-client';

const loginCookie = '__Host-alchemy_login';
const sessionCookie = '__Host-alchemy_session';
const attributes = '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=';
const cookie = (name, value, age) => name + '=' + value + attributes + age;

function returnDestination(path, origin) {
  if (!path || path.length > 2048 || !path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(path)) return '/';
  const destination = new URL(path, origin);
  if (destination.origin !== origin) return '/';
  if (['/account', '/account/invitations'].includes(destination.pathname) || destination.pathname.startsWith('/workspaces/') ||
    /^\/invite\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(destination.pathname)) {
    return destination.pathname + destination.search;
  }
  return '/';
}
const failure = () => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign-in unavailable | Flex Alchemy</title><link rel="stylesheet" href="/style.css"></head>
<body><main><h1>Sign-in could not be completed</h1>
<p>Start a fresh sign-in. If the problem persists, check your account and workspace access.</p>
<p><a href="/auth/sign-in">Start a fresh sign-in</a></p><p><a href="/access-help">Get access help</a></p>
</main></body></html>`, {
  status: 400, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  },
});

export function oidcBrowserFlow({ config, sessions, publicOrigin }) {
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== publicOrigin) {
    throw new TypeError('OIDC requires a canonical HTTPS public origin');
  }
  const redirectUri = publicOrigin + '/auth/callback';
  oidc.enableNonRepudiationChecks(config);
  return async function handle(request) {
    const url = new URL(request.url);
    if (url.origin !== publicOrigin || request.method !== 'GET') return null;
    if (url.pathname === '/auth/sign-in') {
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      const verifier = oidc.randomPKCECodeVerifier();
      const location = oidc.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri, scope: 'openid', state, nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256',
      });
      const returnPath = url.searchParams.getAll('return').length === 1
        ? returnDestination(url.searchParams.get('return'), publicOrigin) : '/';
      const handle = await sessions.beginLogin({ state, nonce, verifier, returnPath });
      return new Response(null, { status: 303, headers: {
        Location: location.href, 'Set-Cookie': cookie(loginCookie, handle, 600),
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      } });
    }
    if (url.pathname !== '/auth/callback') return null;
    try {
      const handles = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim())
        .filter(part => part.startsWith(loginCookie + '='));
      if (handles.length !== 1 || url.searchParams.getAll('state').length !== 1) return failure();
      const state = url.searchParams.get('state');
      const attempt = await sessions.consumeLogin(handles[0].slice(loginCookie.length + 1), state);
      if (!attempt) return failure();
      const tokens = await oidc.authorizationCodeGrant(config, url, {
        pkceCodeVerifier: attempt.verifier, expectedNonce: attempt.nonce, expectedState: state,
      });
      const claims = tokens.claims();
      if (!claims?.iss || !claims.sub) return failure();
      const token = await sessions.issue({ issuer: claims.iss, subject: claims.sub });
      const headers = new Headers({ Location: returnDestination(attempt.return_path, publicOrigin),
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      headers.append('Set-Cookie', cookie(sessionCookie, token, 28_800));
      headers.append('Set-Cookie', cookie(loginCookie, '', 0));
      return new Response(null, { status: 303, headers });
    } catch {
      return failure();
    }
  };
}

export async function discoverBrowserFlow({ issuer, clientId, clientSecret, sessions, publicOrigin }) {
  const issuerUrl = new URL(issuer);
  if (issuerUrl.protocol !== 'https:' || !clientId || !clientSecret) {
    throw new TypeError('Configure an HTTPS issuer and confidential OIDC client');
  }
  const config = await oidc.discovery(issuerUrl, clientId, clientSecret);
  return oidcBrowserFlow({ config, sessions, publicOrigin });
}
