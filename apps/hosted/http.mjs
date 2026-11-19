import { createServer } from 'node:http';

const maxBody = 32 * 1024;

export function hostedHttpServer({ handle, publicOrigin, checkReady }) {
  const expectedHost = new URL(publicOrigin).host;
  return createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, async (incoming, outgoing) => {
    outgoing.setHeader('Cache-Control', 'no-store');
    outgoing.setHeader('X-Content-Type-Options', 'nosniff');
    outgoing.setHeader('Referrer-Policy', 'no-referrer');
    outgoing.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    if (incoming.headers.host !== expectedHost || !/^\/(?![\/\\])/.test(incoming.url ?? '')) {
      outgoing.writeHead(400).end('Invalid host or request target');
      return;
    }
    try {
      const method = incoming.method;
      if (method === 'GET' && incoming.url === '/health/live') {
        outgoing.writeHead(200, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ status: 'alive' }));
        return;
      }
      if (method === 'GET' && incoming.url === '/health/ready' && checkReady) {
        let ready = false;
        try { ready = await checkReady(); } catch { /* Dependency unavailable. */ }
        outgoing.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ status: ready ? 'ready' : 'unavailable' }));
        return;
      }
      if (!['GET', 'POST'].includes(method)) {
        outgoing.writeHead(405, { Allow: 'GET, POST' }).end();
        return;
      }
      const chunks = [];
      let size = 0;
      if (method === 'POST') {
        for await (const chunk of incoming.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > maxBody) {
            outgoing.writeHead(413, { Connection: 'close' }).end('Request body too large');
            return;
          }
          chunks.push(chunk);
        }
      }
      const request = new Request(publicOrigin + incoming.url, {
        method, headers: incoming.headers, ...(method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
      });
      const response = await handle(request);
      for (const [key, value] of response.headers) {
        if (key !== 'set-cookie') outgoing.setHeader(key, value);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader('Set-Cookie', cookies);
      outgoing.writeHead(response.status).end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(503).end('Workspace temporarily unavailable');
    }
  });
}
