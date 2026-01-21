import { createBearerGuard } from '../auth/bearer-guard.js';
import { createTokenVerifier } from '../auth/token-verifier.js';

type McpGuardConfig = {
  issuer: string;
  audience: string;
};

const createMcpGuard = ({ issuer, audience }: McpGuardConfig) =>
  createBearerGuard({
    verifyToken: createTokenVerifier({
      issuer,
      audience,
    }),
    requiredScopes: ['hoge'],
  });

export { createMcpGuard };
