#!/usr/bin/env node
/**
 * MTN MoMo end-to-end smoke test (sandbox).
 * Reads credentials from backend/.env and exercises the full Collections flow:
 *   token → requestToPay → status check.
 * Usage: node scripts/momo-smoke-test.js
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};

const SUB = get('MOMO_SUBSCRIPTION_KEY');
const USER = get('MOMO_API_USER');
const KEY = get('MOMO_API_KEY');
const BASE = get('MOMO_BASE_URL') || 'https://sandbox.momodeveloper.mtn.com';
const ENV = get('MOMO_TARGET_ENVIRONMENT') || 'sandbox';
const CUR = get('MOMO_CURRENCY') || 'EUR';

(async () => {
  if (!SUB || !USER || !KEY) {
    console.error('Missing MOMO_SUBSCRIPTION_KEY / MOMO_API_USER / MOMO_API_KEY in .env');
    process.exit(1);
  }

  // 1) Access token
  const basic = Buffer.from(`${USER}:${KEY}`).toString('base64');
  let r = await fetch(`${BASE}/collection/token/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Ocp-Apim-Subscription-Key': SUB },
  });
  console.log(`[1] token  -> HTTP ${r.status}`);
  if (!r.ok) { console.error(await r.text()); process.exit(1); }
  const tok = await r.json();
  console.log(`    access_token received (expires_in=${tok.expires_in}s)`);
  const token = tok.access_token;

  // 2) Request to Pay
  const ref = randomUUID();
  const extId = 'SMOKE-' + ref.slice(0, 8);
  r = await fetch(`${BASE}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': ref,
      'X-Target-Environment': ENV,
      'Ocp-Apim-Subscription-Key': SUB,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: '50',
      currency: CUR,
      externalId: extId,
      payer: { partyIdType: 'MSISDN', partyId: '46733123453' },
      payerMessage: 'Test T-Cardio',
      payeeNote: 'Smoke test',
    }),
  });
  console.log(`[2] requestToPay (ref=${ref}) -> HTTP ${r.status} ${r.status === 202 ? '(202 = accepte, en attente)' : ''}`);
  if (r.status !== 202) { console.error(await r.text()); process.exit(1); }

  // 3) Status (poll a few times)
  for (let i = 1; i <= 3; i++) {
    await new Promise((x) => setTimeout(x, 2000));
    r = await fetch(`${BASE}/collection/v1_0/requesttopay/${ref}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Target-Environment': ENV,
        'Ocp-Apim-Subscription-Key': SUB,
      },
    });
    const s = await r.json();
    console.log(`[3.${i}] status -> ${s.status}${s.financialTransactionId ? ' fin_txn=' + s.financialTransactionId : ''}${s.reason ? ' reason=' + JSON.stringify(s.reason) : ''}`);
    if (s.status && s.status !== 'PENDING') break;
  }

  console.log('\n✅ Smoke test terminé — la chaîne MTN MoMo (token + requestToPay + status) fonctionne.');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
