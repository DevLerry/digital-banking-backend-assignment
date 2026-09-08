import { env } from '../config/env.js';
import { NibssError } from './errors.js';
import { getNibssToken, invalidateNibssToken } from './token.js';
import type { BankAccount, KycIdentity, RawWrapped, TransferResult } from './types.js';

/**
 * THE ANTI-CORRUPTION LAYER.
 *
 * Every call to NibssByPhoenix goes through this file and nowhere else — no
 * route handler or service ever calls fetch() directly.
 *
 * This boundary earns its keep immediately. Verified against the live API:
 *   - `kycType` MUST be lowercase ('bvn'), even though Swagger documents 'BVN'.
 *     Uppercase returns HTTP 500.
 *   - BVN endpoints wrap their payload in `data`, NIN endpoints in `response`,
 *     and account creation in `account`. Three shapes for one idea.
 * We absorb all of that here, once, so the rest of the app never sees it.
 */

interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  auth: boolean;
}

async function request<T>(opts: RequestOptions, isRetry = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth) headers.Authorization = `Bearer ${await getNibssToken()}`;

  const res = await fetch(`${env.NIBSS_BASE_URL}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const parsed = (await res.json().catch(() => null)) as unknown;

  // Self-healing auth: a rejected cached token is discarded and retried ONCE.
  if (res.status === 401 && opts.auth && !isRetry) {
    invalidateNibssToken();
    return request<T>(opts, true);
  }

  if (!res.ok) {
    const message =
      (parsed as { message?: string } | null)?.message ?? `NIBSS request failed (${res.status})`;
    throw new NibssError(message, res.status, parsed, opts.path);
  }

  return parsed as T;
}

/** Pull the payload out of whichever wrapper key NIBSS happened to use. */
function unwrap<T>(raw: RawWrapped<T>, endpoint: string): T {
  const inner = raw.data ?? raw.response ?? raw.account;
  if (!inner) {
    throw new NibssError('Unexpected NIBSS response shape', 502, raw, endpoint);
  }
  return inner;
}

/** NIBSS returns dob as a full ISO timestamp; we want plain 'YYYY-MM-DD'. */
function toPlainDate(value: string | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export const nibss = {
  // ---------- KYC (no bearer token) ----------

  async insertBvn(input: {
    bvn: string; firstName: string; lastName: string; dob: string; phone: string;
  }): Promise<void> {
    await request<RawWrapped<unknown>>({
      method: 'POST', path: '/api/insertBvn', body: input, auth: false,
    });
  },

  async validateBvn(bvn: string): Promise<KycIdentity> {
    const raw = await request<RawWrapped<Record<string, string>>>({
      method: 'POST', path: '/api/validateBvn', body: { bvn }, auth: false,
    });
    const d = unwrap(raw, '/api/validateBvn');
    return {
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      dob: toPlainDate(d.dob),
      phone: d.phone,
    };
  },

  async insertNin(input: {
    nin: string; firstName: string; lastName: string; dob: string;
  }): Promise<void> {
    await request<RawWrapped<unknown>>({
      method: 'POST', path: '/api/insertNin', body: input, auth: false,
    });
  },

  async validateNin(nin: string): Promise<KycIdentity> {
    const raw = await request<RawWrapped<Record<string, string>>>({
      method: 'POST', path: '/api/validateNin', body: { nin }, auth: false,
    });
    const d = unwrap(raw, '/api/validateNin');
    return {
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      dob: toPlainDate(d.dob),
    };
  },

  // ---------- Banking (bearer token required) ----------

  async createAccount(input: {
    kycType: 'BVN' | 'NIN'; kycID: string; dob: string;
  }): Promise<BankAccount> {
    const raw = await request<RawWrapped<BankAccount>>({
      method: 'POST',
      path: '/api/account/create',
      // CRITICAL: lowercase. Uppercase 'BVN' returns HTTP 500 despite the docs.
      body: { kycType: input.kycType.toLowerCase(), kycID: input.kycID, dob: input.dob },
      auth: true,
    });
    return unwrap(raw, '/api/account/create');
  },

  nameEnquiry(accountNumber: string): Promise<BankAccount> {
    return request<BankAccount>({
      method: 'GET',
      path: `/api/account/name-enquiry/${encodeURIComponent(accountNumber)}`,
      auth: true,
    });
  },

  balance(accountNumber: string): Promise<BankAccount> {
    return request<BankAccount>({
      method: 'GET',
      path: `/api/account/balance/${encodeURIComponent(accountNumber)}`,
      auth: true,
    });
  },

  transfer(input: { from: string; to: string; amount: number }): Promise<TransferResult> {
    return request<TransferResult>({
      method: 'POST', path: '/api/transfer', body: input, auth: true,
    });
  },

  getTransaction(reference: string): Promise<TransferResult> {
    return request<TransferResult>({
      method: 'GET',
      path: `/api/transaction/${encodeURIComponent(reference)}`,
      auth: true,
    });
  },

  /**
   * Returns EVERY account our fintech has created — i.e. all our customers.
   * DANGER: never expose this to a customer-facing route (Requirement 4).
   */
  listAccounts(): Promise<BankAccount[]> {
    return request<BankAccount[]>({ method: 'GET', path: '/api/accounts', auth: true });
  },
};
