import type { AuthorizationResponse } from '@authlete/typescript-sdk/dist/commonjs/models';

export type AuthorizationSession = {
  authorizationResponse?: AuthorizationResponse;
};
