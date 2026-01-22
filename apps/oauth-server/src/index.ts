import 'dotenv/config';

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors'
import { type Session, useSession, useSessionStorage, type Storage } from '@hono/session';
import { serve } from '@hono/node-server';
import type { AuthorizationSession } from './types/session';
import {
  sampleClientHandler,
} from './samples/handlers';

const app = new Hono();
const PORT = Number(process.env.OAUTH_PORT ?? 9000);
const SESSION_SECRET =
  process.env.AUTH_SECRET ??
  '0000000000000000000000000000000000000000000000000000000000000000';

declare module 'hono' {
  interface ContextVariableMap {
    session: Session<AuthorizationSession>;
  }
}

const sessionStore = new Map<string, AuthorizationSession>();
const sessionStorage: Storage<AuthorizationSession> = {
  get: (sid) => sessionStore.get(sid) ?? null,
  set: (sid, value) => {
    sessionStore.set(sid, value);
  },
  delete: (sid) => {
    sessionStore.delete(sid);
  },
};

app.use(useSessionStorage(sessionStorage));
app.use(
  useSession({
    secret: SESSION_SECRET,
  }),
);

const corsHandler = cors({
  origin: (origin) => origin,
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ["DPoP", "Authorization", "Content-Type"]
})

app.use('/token', corsHandler)
app.use('/userinfo', corsHandler)
app.use('/jwks', cors())
app.use('/.well-known/*', cors())

app.get('/', (c: Context) =>
  c.json({
    service: 'oauth-server',
    status: 'ok',
    note: 'Development stub running over http',
  }));

app.get('/sample-client', sampleClientHandler);

app.post('/consent', (c: Context) => c.json({ error: 'not_implemented' }, 501));

app.get('/authorize', (c: Context) => c.json({ error: 'not_implemented' }, 501));

app.post('/token', (c: Context) => c.json({ error: 'not_implemented' }, 501));

app.get('/jwks', (c: Context) => c.json({ error: 'not_implemented' }, 501));

app.get('/.well-known/openid-configuration', (c: Context) =>
  c.json({ error: 'not_implemented' }, 501));

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

server.addListener('listening', () => {
  console.log(`oauth-server listening on http://localhost:${PORT}`);
});
