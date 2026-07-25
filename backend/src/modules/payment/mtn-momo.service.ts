import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MomoStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface MomoTransactionStatus {
  status: MomoStatus;
  financialTransactionId?: string;
  reason?: string;
  amount?: string;
  currency?: string;
  externalId?: string;
}

interface MomoConfig {
  baseUrl: string;
  targetEnvironment: string;
  subscriptionKey: string;
  apiUser: string;
  apiKey: string;
  currency: string;
  countryCode: string;
  callbackUrl: string;
}

/**
 * Thin, dependency-free client for the MTN MoMo Collections API.
 *
 * Uses the native `fetch` (Node 18+). Caches the OAuth access token (valid ~1h)
 * and refreshes it shortly before expiry. All methods fail loudly with a clear
 * error message; callers decide how to surface that.
 */
@Injectable()
export class MtnMomoService {
  private readonly logger = new Logger(MtnMomoService.name);
  private readonly cfg: MomoConfig;

  // Cached access token
  private accessToken: string | null = null;
  private tokenExpiresAt = 0; // epoch ms

  constructor(private readonly configService: ConfigService) {
    this.cfg = this.configService.get<MomoConfig>('momo')!;

    if (this.isEnabled()) {
      this.logger.log(
        `MTN MoMo enabled: env=${this.cfg.targetEnvironment}, currency=${this.cfg.currency}, base=${this.cfg.baseUrl}`,
      );
    } else {
      this.logger.warn(
        'MTN MoMo NOT configured (missing subscription key / API user / API key) — ' +
          'falling back to manual USSD + admin validation.',
      );
    }
  }

  /**
   * True when the MTN MoMo API credentials are configured.
   * When false, the app uses the manual USSD flow instead.
   */
  isEnabled(): boolean {
    return Boolean(
      this.cfg.subscriptionKey && this.cfg.apiUser && this.cfg.apiKey,
    );
  }

  getCurrency(): string {
    return this.cfg.currency;
  }

  /**
   * Normalise a local phone number to an MTN MSISDN (international, no '+').
   *
   * Côte d'Ivoire keeps the leading "0" of the 10-digit national number:
   *   "0197548441"        → "2250197548441"
   *   "+225 01 97 54 84 41" → "2250197548441"
   *   "002250197548441"   → "2250197548441"
   *   "2250197548441"     → unchanged
   */
  normalizeMsisdn(raw: string): string {
    let digits = (raw || '').replace(/\D/g, '');
    const cc = this.cfg.countryCode;
    // International access prefix "00" + country code → strip the "00".
    if (digits.startsWith('00' + cc)) digits = digits.slice(2);
    // Already in international form.
    if (digits.startsWith(cc)) return digits;
    // Prefix the country code WITHOUT stripping the national trunk "0"
    // (required for Côte d'Ivoire's 10-digit numbering plan).
    return `${cc}${digits}`;
  }

  /**
   * Get a valid OAuth access token, minting a new one if needed.
   * Basic auth: username=apiUser, password=apiKey.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const basic = Buffer.from(`${this.cfg.apiUser}:${this.cfg.apiKey}`).toString(
      'base64',
    );

    const res = await fetch(`${this.cfg.baseUrl}/collection/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `MoMo token request failed: HTTP ${res.status} ${body.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
    return this.accessToken;
  }

  /**
   * Initiate a Request to Pay. MTN pushes a PIN prompt to the payer's phone.
   * Returns once MTN has accepted the request (HTTP 202); the actual payment
   * outcome must be polled via getTransactionStatus() or received by callback.
   *
   * @param referenceId UUID v4 — the transaction id (also used to poll status).
   */
  async requestToPay(params: {
    referenceId: string;
    amount: number;
    externalId: string;
    msisdn: string;
    payerMessage: string;
    payeeNote: string;
  }): Promise<void> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': params.referenceId,
      'X-Target-Environment': this.cfg.targetEnvironment,
      'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
      'Content-Type': 'application/json',
    };
    if (this.cfg.callbackUrl) {
      headers['X-Callback-Url'] = this.cfg.callbackUrl;
    }

    const body = {
      amount: String(params.amount),
      currency: this.cfg.currency,
      externalId: params.externalId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: this.normalizeMsisdn(params.msisdn),
      },
      payerMessage: params.payerMessage,
      payeeNote: params.payeeNote,
    };

    const res = await fetch(`${this.cfg.baseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // 202 Accepted = request taken; anything else is an error.
    if (res.status !== 202) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `MoMo requestToPay failed: HTTP ${res.status} ${text.slice(0, 200)}`,
      );
    }

    this.logger.log(
      `MoMo requestToPay accepted: ref=${params.referenceId}, amount=${params.amount} ${this.cfg.currency}`,
    );
  }

  /**
   * Authoritatively check the status of a Request to Pay by its referenceId.
   * This is the source of truth — always call it before granting value,
   * even when a (potentially forged) callback arrived.
   */
  async getTransactionStatus(
    referenceId: string,
  ): Promise<MomoTransactionStatus> {
    const token = await this.getAccessToken();

    const res = await fetch(
      `${this.cfg.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': this.cfg.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `MoMo status check failed: HTTP ${res.status} ${text.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as Record<string, any>;

    // `reason` may be a string code or an object { code, message } depending on
    // the gateway — normalise to a string.
    let reason: string | undefined;
    if (typeof data.reason === 'string') reason = data.reason;
    else if (data.reason && typeof data.reason === 'object')
      reason = data.reason.code || data.reason.message;

    return {
      status: data.status as MomoStatus,
      financialTransactionId: data.financialTransactionId,
      reason,
      amount: data.amount,
      currency: data.currency,
      externalId: data.externalId,
    };
  }
}
