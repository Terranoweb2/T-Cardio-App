#!/usr/bin/env node
/**
 * MTN MoMo — Sandbox provisioning.
 *
 * Creates an API User + API Key in the MTN MoMo SANDBOX so the backend can mint
 * access tokens. Run this once after subscribing to the "Collections" product on
 * https://momodeveloper.mtn.com and copying its Primary Key.
 *
 * Usage:
 *   MOMO_SUBSCRIPTION_KEY=<collections primary key> node scripts/momo-sandbox-setup.js
 *
 * Optional env:
 *   MOMO_BASE_URL            (default https://sandbox.momodeveloper.mtn.com)
 *   MOMO_PROVIDER_CALLBACK_HOST  (default derived from MOMO_CALLBACK_URL or t-cardio.org)
 *
 * On success it prints the MOMO_API_USER and MOMO_API_KEY to put in your .env.
 * (Production credentials are NOT created here — they come from the MTN Partner Portal.)
 */
const { randomUUID } = require('crypto');

const BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const SUB_KEY = process.env.MOMO_SUBSCRIPTION_KEY || '';

function deriveCallbackHost() {
  if (process.env.MOMO_PROVIDER_CALLBACK_HOST) return process.env.MOMO_PROVIDER_CALLBACK_HOST;
  const url = process.env.MOMO_CALLBACK_URL;
  if (url) {
    try {
      return new URL(url).host;
    } catch {
      /* fall through */
    }
  }
  return 't-cardio.org';
}

async function main() {
  if (!SUB_KEY) {
    console.error(
      'ERROR: MOMO_SUBSCRIPTION_KEY is required.\n' +
        'Get it from momodeveloper.mtn.com → your profile → Collections (Primary Key).',
    );
    process.exit(1);
  }

  const apiUserId = randomUUID();
  const callbackHost = deriveCallbackHost();

  console.log(`MTN MoMo sandbox provisioning`);
  console.log(`  base URL      : ${BASE_URL}`);
  console.log(`  callback host : ${callbackHost}`);
  console.log(`  API user (new): ${apiUserId}\n`);

  // 1) Create API user
  let res = await fetch(`${BASE_URL}/v1_0/apiuser`, {
    method: 'POST',
    headers: {
      'X-Reference-Id': apiUserId,
      'Ocp-Apim-Subscription-Key': SUB_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerCallbackHost: callbackHost }),
  });
  if (res.status !== 201) {
    const body = await res.text().catch(() => '');
    console.error(`Create API user failed: HTTP ${res.status} ${body}`);
    process.exit(1);
  }
  console.log('✔ API user created');

  // 2) Create API key
  res = await fetch(`${BASE_URL}/v1_0/apiuser/${apiUserId}/apikey`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': SUB_KEY },
  });
  if (res.status !== 201) {
    const body = await res.text().catch(() => '');
    console.error(`Create API key failed: HTTP ${res.status} ${body}`);
    process.exit(1);
  }
  const { apiKey } = await res.json();
  console.log('✔ API key created');

  // 3) Verify
  res = await fetch(`${BASE_URL}/v1_0/apiuser/${apiUserId}`, {
    headers: { 'Ocp-Apim-Subscription-Key': SUB_KEY },
  });
  const info = await res.json().catch(() => ({}));
  console.log(`✔ Verified: targetEnvironment=${info.targetEnvironment}, callbackHost=${info.providerCallbackHost}\n`);

  console.log('Add these to your .env:\n');
  console.log(`MOMO_API_USER=${apiUserId}`);
  console.log(`MOMO_API_KEY=${apiKey}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
