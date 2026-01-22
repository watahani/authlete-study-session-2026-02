import { Authlete } from '@authlete/typescript-sdk';

let authleteInstance: Authlete | null = null;

export const getAuthlete = () => {
  if (!authleteInstance) {
    if (!process.env.AUTHLETE_BASE_URL) {
      console.warn('AUTHLETE_BASE_URL is not set.');
    }
    if (!process.env.AUTHLETE_SERVICE_ACCESSTOKEN) {
      console.warn('AUTHLETE_SERVICE_ACCESSTOKEN is not set.');
    }
    authleteInstance = new Authlete({
      serverURL: process.env.AUTHLETE_BASE_URL,
      bearer: process.env.AUTHLETE_SERVICE_ACCESSTOKEN
    });
  }

  return authleteInstance;
};
