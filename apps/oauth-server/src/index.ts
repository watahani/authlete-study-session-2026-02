import 'dotenv/config';

import { Hono } from 'hono';
import { cors } from 'hono/cors'
import { type Session, useSession } from '@hono/session';
import { serve } from '@hono/node-server';

const app = new Hono();
const PORT = Number(process.env.OAUTH_PORT ?? 9000);
const SESSION_SECRET =
  process.env.AUTH_SECRET ??
  '0000000000000000000000000000000000000000000000000000000000000000';

type LoginSession = {
  loggedIn: boolean;
};

declare module 'hono' {
  interface ContextVariableMap {
    session: Session<LoginSession>;
  }
}

app.use(
  useSession({
    secret: SESSION_SECRET,
  }),
);

const corsHandler = cors({
  origin: (origin) => origin,
  allowMethods: ['POST'],
  allowHeaders: ["DPoP"]  
})

app.use('/token', corsHandler)
app.use('/userinfo', corsHandler)
app.use('/jwks', cors())
app.use('/.well-known/*', cors())


app.get('/', (c) =>
  c.json({
    service: 'oauth-server',
    status: 'ok',
    note: 'Development stub running over http',
  }),
);

app.get('/login', async (c) => {
  const data = (await c.var.session.get()) as LoginSession | null;
  const loggedIn = Boolean(data?.loggedIn);
  const returnTo = resolveReturnTo(c.req.query('return_to') ?? c.req.header('referer'));

  if (loggedIn && returnTo !== '/login') {
    return c.redirect(returnTo);
  }

  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Demo Login</title>
  </head>
  <body>
    <main>
      <h1>Demo Login</h1>
      <p>Status: ${loggedIn ? 'Logged in' : 'Logged out'}</p>
      ${loggedIn
        ? `<form method="post" action="/logout" style="margin-top: 12px;">
        <input type="hidden" name="return_to" value="${returnTo}" />
        <button type="submit">Log out</button>
      </form>`
        : `<form method="post" action="/login">
        <input type="hidden" name="return_to" value="${returnTo}" />
        <button type="submit">Log in</button>
      </form>`}
    </main>
  </body>
</html>`);
});

app.post('/login', async (c) => {
  await c.var.session.update({ loggedIn: true } satisfies LoginSession);
  const body = await c.req.parseBody();
  const returnTo = resolveReturnTo(typeof body.return_to === 'string' ? body.return_to : undefined);
  return c.redirect(returnTo);
});

app.post('/logout', async (c) => {
  await c.var.session.delete();
  const body = await c.req.parseBody();
  const returnTo = resolveReturnTo(typeof body.return_to === 'string' ? body.return_to : undefined);
  return c.redirect(returnTo);
});

app.get('/authorize', (c) => {
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');

  return c.json({
    message: 'Authorization endpoint stub',
    received: { clientId, redirectUri },
  });
});


app.post('/token', async (c) => {
  const body = await c.req.parseBody();

  return c.json({
    message: 'Token endpoint stub',
    body,
    access_token: 'dev-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
  });
});

app.get('/jwks', (c) =>
  c.json({
    keys: [],
  }),
);

app.get('/.well-known/openid-configuration', (c) => {
  const origin = process.env.PUBLIC_OAUTH_BASE_URL ?? `http://localhost:${PORT}`;

  return c.json({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    jwks_uri: `${origin}/jwks`,
  });

});

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

server.addListener('listening', () => {
  console.log(`oauth-server listening on http://localhost:${PORT}`);
});

function resolveReturnTo(candidate: string | undefined) {
  if (!candidate) {
    return '/login';
  }

  try {
    if (candidate.startsWith('/')) {
      return candidate;
    }

    const url = new URL(candidate);
    if (url.host === issuerHost()) {
      return url.toString();
    }
  } catch {
    return '/login';
  }

  return '/login';
}

function issuerHost() {
  const issuer = process.env.OAUTH_SERVER_ISSUER ?? `http://localhost:${PORT}`;
  try {
    return new URL(issuer).host;
  } catch {
    return `localhost:${PORT}`;
  }
}
