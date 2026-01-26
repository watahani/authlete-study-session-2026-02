import type { Context } from 'hono';
import {
    type AuthorizationFailResponse,
    type AuthorizationRequest,
    type AuthorizationResponse,
    type ClientLimitedAuthorization,
    type TokenRequest,
    type TokenResponse
} from '@authlete/typescript-sdk/dist/commonjs/models';
import type { AuthorizationSession } from '../types/session';
import type { User } from '../types/user';

const demoUser: User = {
    id: 'demo-user',
    claims: {
        family_name: 'Demo',
        given_name: 'Authlete',
        preffered_username: "Authlete Demo User"
    },
    consentedScopes: [],
};

export const sampleClientHandler = (c: Context) => {
    const tokenEndpoint = '/token';
    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sample Client</title>
  </head>
  <body>
    <main>
      <h1>Sample Client</h1>
      <h2>Authorization Request</h2>
      <pre id="authorize-url">Loading...</pre>
      <button id="authorize" type="button">Start authorization</button>
      <h2>Callback Query</h2>
      <pre id="params">Loading...</pre>
      <button id="exchange" type="button">Exchange code</button>
      <button id="reset" type="button">Reset</button>
      <h2>Token Response</h2>
      <pre id="result">Waiting...</pre>
    </main>
    <script>
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      const paramsView = document.getElementById('params');
      const authorizeUrlView = document.getElementById('authorize-url');
      const result = document.getElementById('result');
      const authorizeButton = document.getElementById('authorize');
      const exchangeButton = document.getElementById('exchange');
      const resetButton = document.getElementById('reset');
      const authorizeEndpoint = '/authorize';
      const pkceStorageKey = 'sample-client:pkce_verifier';

      paramsView.textContent = JSON.stringify(Object.fromEntries(params), null, 2) || '{}';
      exchangeButton.disabled = !code || Boolean(error);

      if (error) {
        result.textContent = 'Error: ' + error;
      } else if (!code) {
        result.textContent = 'No code in query string.';
      }

      function base64UrlEncode(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
      }

      function generateVerifier() {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return base64UrlEncode(bytes);
      }

      async function sha256(input) {
        const data = new TextEncoder().encode(input);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(digest);
      }

      async function buildAuthorizeUrl() {
        const verifier = generateVerifier();
        const challengeBytes = await sha256(verifier);
        const challenge = base64UrlEncode(challengeBytes);
        sessionStorage.setItem(pkceStorageKey, verifier);
        const authorizeParams = new URLSearchParams({
          response_type: 'code',
          client_id: 'sample-client',
          redirect_uri: window.location.origin + '/sample-client',
          scope: 'openid profile',
          code_challenge: challenge,
          code_challenge_method: 'S256',
        });
        return authorizeEndpoint + '?' + authorizeParams.toString();
      }

      async function refreshAuthorizeUrl() {
        if (!window.crypto || !window.crypto.subtle) {
          authorizeUrlView.textContent = 'Crypto APIs are not available in this browser.';
          authorizeButton.disabled = true;
          return;
        }
        const authorizeUrl = await buildAuthorizeUrl();
        authorizeUrlView.textContent = authorizeUrl;
        authorizeButton.addEventListener('click', () => {
          window.location.href = authorizeUrl;
        }, { once: true });
      }

      if (!code && !error) {
        refreshAuthorizeUrl();
      }

      exchangeButton.addEventListener('click', () => {
        if (!code || error) {
          return;
        }
        result.textContent = 'Exchanging code...';
        const verifier = sessionStorage.getItem(pkceStorageKey);
        if (!verifier) {
          result.textContent = 'PKCE verifier not found. Start authorization again.';
          return;
        }
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: 'sample-client',
          redirect_uri: window.location.origin + '/sample-client',
          code_verifier: verifier,
        });

        fetch('${tokenEndpoint}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
          .then((res) => res.json())
          .then((data) => {
            result.textContent = JSON.stringify(data, null, 2);
          })
          .catch((err) => {
            result.textContent = 'Token request failed: ' + err;
          });
      });

      resetButton.addEventListener('click', () => {
        sessionStorage.removeItem(pkceStorageKey);
        window.location.href = window.location.origin + '/sample-client';
      });
    </script>
  </body>
</html>`);
};



export const authorizeHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const parameters = c.req.url.split('?')[1] ?? '';
    const authorizationRequest: AuthorizationRequest = {
        parameters
    };

    const response: AuthorizationResponse = await authlete.authorization.processRequest({
        serviceId: serviceId,
        authorizationRequest
    });

    return handleAuthorizeAction(c, response);
};

export const jwksHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const jwks = await authlete.jwkSetEndpoint.serviceJwksGetApi({
        serviceId
    });
    return c.json(jwks);
};

export const openIdConfigHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const config = await authlete.service.getConfiguration({
        serviceId
    })
    return c.json(config)
};

async function handleAuthorizeAction(
    c: Context,
    response: AuthorizationResponse
) {
    const { authlete, serviceId } = c.var;
    const responseContent = response.responseContent ?? '';
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');

    switch (response.action) {
        case 'INTERNAL_SERVER_ERROR':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 500);
        case 'BAD_REQUEST':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 400);
        case 'LOCATION':
            if (responseContent) {
                return c.redirect(responseContent);
            }
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
        case 'FORM':
            c.header('Content-Type', 'text/html; charset=UTF-8');
            return c.body(responseContent, 200);
        case 'INTERACTION':
            const authorizationSession = response.ticket
                ? {
                      ticket: response.ticket,
                      scopesToConsent: response.scopes
                          ?.map((scope) => scope.name)
                          .filter((scope): scope is string => Boolean(scope)) ?? [],
                  }
                : undefined;
            await c.var.session.update((prev) => ({
                ...prev,
                authorization: authorizationSession,
            } satisfies AuthorizationSession));
            return renderConsent(c, response);
        case 'NO_INTERACTION':
            const errorResponse = await authlete.authorization.fail({
                serviceId,
                authorizationFailRequest: {
                    ticket: response.ticket!,
                    reason: 'SERVER_ERROR',
                    description: 'prompt=none is not supported in this sample server'
                }
            });
            return handleFailAction(c, errorResponse);
        default:
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
    }
}

async function renderConsent(
    c: Context,
    response: AuthorizationResponse
) {
    const clientName = response.client?.clientName || 'Unknown Client';
    const clientId = resolveClientId(response) || 'unknown-client-id';
    const scopes = response.scopes ?? [];
    const resources = response.resources ?? [];

    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Consent</title>
  </head>
  <body>
    <main>
      <h1>Consent</h1>
      <p>Client: ${clientName}</p>
      <p>Client ID: ${clientId}</p>
      <h2>Scopes</h2>
      ${scopes.length === 0 ? '<p>No scopes requested.</p>' : `<ul>${scopes.map((scope) => `<li>${scope.name}: ${scope.description}</li>`).join('')}</ul>`}
      <h2>Resources</h2>
      ${resources.length === 0 ? '<p>No resources requested.</p>' : `<ul>${resources.map((resource) => `<li>${resource}</li>`).join('')}</ul>`}
      <form method="post" action="/consent" style="margin-top: 12px;">
      <button type="submit" name="decision" value="approve">Log in and approve</button>
      <button type="submit" name="decision" value="deny">Deny</button>
      </form>
    </main>
  </body>
</html>`);
}

function resolveClientId(info: AuthorizationResponse) {
    if (!info.client) {
        return null;
    }
    const client: ClientLimitedAuthorization = info.client;
    switch (client.clientSource) {
        case 'AUTOMATIC_REGISTRATION':
        case 'EXPLICIT_REGISTRATION':
            if (client.entityId) {
                return client.entityId;
            } else {
                throw new Error('Client entityId is missing');
            }
        case 'METADATA_DOCUMENT':
        // return client.metadataDocumentLocation; //TODO
        case 'DYNAMIC_REGISTRATION':
        case 'STATIC_REGISTRATION':
            return client.clientIdAlias;
        default:
            return client.clientIdAlias;
    }
}

export const consentHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const data = (await c.var.session.get()) as AuthorizationSession | null;
    const body = await c.req.parseBody();
    const decision = typeof body.decision === 'string' ? body.decision : '';
    console.log('Consent decision:', decision);
    if (!data || !data.authorization) {
        return c.json(
            {
                error: 'server_error',
                error_description: 'Authorization session not found'
            },
            500,
        );
    }

    if (decision !== 'approve') {
        c.var.session.update((prev) => ({
            ...prev,
            authorization: undefined,
        } satisfies AuthorizationSession));
        const failResponse = await authlete.authorization.fail({
            serviceId,
            authorizationFailRequest: {
                ticket: data.authorization.ticket,
                reason: 'DENIED',
                description: 'User denied the authorization request'
            }
        })

        return handleFailAction(c, failResponse);

    } if (!data.authorization.ticket) {
        return c.json(
            {
                error: 'server_error',
                error_description: 'Authorization ticket not found'
            },
            500,
        );
    }

    const issueResponse = await authlete.authorization.issue({
        serviceId,
        authorizationIssueRequest: {
            ticket: data.authorization.ticket,
            subject: demoUser.id,
            claims: JSON.stringify(demoUser.claims),
            jwtAtClaims: JSON.stringify(demoUser.claims),
            scopes: data.authorization.scopesToConsent
        }
    });
    switch (issueResponse.action) {
        case 'LOCATION':
            if (issueResponse.responseContent) {
                return c.redirect(issueResponse.responseContent);
            }
        case 'BAD_REQUEST':
            return c.json(
                {
                    error: 'server_error',
                    error_description: issueResponse.resultMessage || 'Failed to issue authorization'
                },
                500,
            );
        default:
            return c.json(
                {
                    error: 'server_error',
                    error_description: `Unsupported action: ${issueResponse.action}`
                },
                500,
            );
    }

};

export const tokenHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const parameters = await c.req.text();
    const authHeader = c.req.header('authorization');
    const credentials = parseBasicCredentials(authHeader);

    const tokenRequest: TokenRequest = {
        parameters,
        clientId: credentials?.clientId,
        clientSecret: credentials?.clientSecret,
    };

    const response = await authlete.token.process({
        serviceId,
        tokenRequest,
    });

    return handleTokenAction(c, response, authHeader);
};

function handleTokenAction(c: Context, response: TokenResponse, authHeader: string | undefined) {
    const responseContent = response.responseContent ?? '';
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');

    switch (response.action) {
        case 'INTERNAL_SERVER_ERROR':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 500);
        case 'INVALID_CLIENT': {
            c.header('Content-Type', 'application/json');
            if (authHeader?.toLowerCase().startsWith('basic ')) {
                c.header('WWW-Authenticate', 'Basic realm="token"');
                return c.body(responseContent, 401);
            }
            return c.body(responseContent, 400);
        }
        case 'BAD_REQUEST':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 400);
        case 'OK':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 200);
        case 'PASSWORD':
        case 'TOKEN_EXCHANGE':
        case 'JWT_BEARER':
            return c.json(
                {
                    error: 'server_error',
                    error_description: ` ${response.action} grant type is not supported in this sample server`
                },
                501,
            );
        default:
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
    }
}

function parseBasicCredentials(authHeader: string | undefined) {
    if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) {
        return null;
    }

    try {
        const encoded = authHeader.slice(6).trim();
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const separatorIndex = decoded.indexOf(':');
        if (separatorIndex === -1) {
            return null;
        }
        return {
            clientId: decoded.slice(0, separatorIndex),
            clientSecret: decoded.slice(separatorIndex + 1),
        };
    } catch {
        return null;
    }
}

function handleFailAction(c: Context, response: AuthorizationFailResponse) {
    const responseContent = response.responseContent ?? '';
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');

    switch (response.action) {
        case 'INTERNAL_SERVER_ERROR':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 500);
        case 'BAD_REQUEST':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 400);
        case 'LOCATION':
            if (responseContent) {
                return c.redirect(responseContent);
            }
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
        case 'FORM':
            c.header('Content-Type', 'text/html; charset=UTF-8');
            return c.body(responseContent, 200);
        default:
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
    }
}
