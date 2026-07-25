import { registerAs } from '@nestjs/config';

/**
 * MTN Mobile Money — Collections API configuration.
 *
 * Sandbox vs production:
 *  - Sandbox base URL: https://sandbox.momodeveloper.mtn.com  (target env "sandbox", currency EUR)
 *  - Production base URL: https://proxy.momoapi.mtn.com        (target env per country, e.g. "mtnci", currency XOF)
 *
 * The API User + API Key are:
 *  - Sandbox: provisioned programmatically (see scripts/momo-sandbox-setup.ts)
 *  - Production: issued via the MTN Partner Portal after KYC (cannot be automated)
 *
 * If `subscriptionKey` / `apiUser` / `apiKey` are not set, the MTN integration is
 * considered DISABLED and the app falls back to the manual USSD + admin validation flow.
 */
export default registerAs('momo', () => ({
  baseUrl:
    process.env.MOMO_BASE_URL ||
    'https://sandbox.momodeveloper.mtn.com',
  // "sandbox" for the sandbox, "mtnci" for Côte d'Ivoire production (confirm with MTN).
  targetEnvironment: process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox',
  // Collections product subscription key (Ocp-Apim-Subscription-Key).
  subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY || '',
  // API User (UUID) + API Key — Basic-auth credentials used to mint access tokens.
  apiUser: process.env.MOMO_API_USER || '',
  apiKey: process.env.MOMO_API_KEY || '',
  // EUR is mandatory in sandbox; XOF in production (Côte d'Ivoire).
  currency: process.env.MOMO_CURRENCY || 'EUR',
  // Country dialing code used to normalise local MSISDNs (Côte d'Ivoire = 225).
  countryCode: process.env.MOMO_COUNTRY_CODE || '225',
  // Full callback URL MTN will POST the result to. Its HOST must match the
  // providerCallbackHost registered with the API user.
  callbackUrl: process.env.MOMO_CALLBACK_URL || '',
}));
