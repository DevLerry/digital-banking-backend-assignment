import { tokenStore } from './tokenStore';
import type {
  Account,
  AuthResponse,
  ApiErrorBody,
  Customer,
  KycStatus,
  NameEnquiry,
  Pagination,
  Transaction,
  TransactionSummary,
  TransferResult,
} from './types';

/**
 * THE FRONTEND'S ANTI-CORRUPTION LAYER.
 *
 * Exactly the same idea as src/nibss/client.ts on the backend: one file owns
 * every network call, so no component ever touches fetch() directly.
 *
 * What that buys us:
 *   - the Authorization header is attached in ONE place, so no screen can
 *     forget it
 *   - a 401 logs the user out everywhere, consistently
 *   - errors arrive as a typed ApiError instead of raw Response objects
 *   - components deal in `Account` and `Transaction`, not HTTP
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/** A failure the API reported deliberately, carrying its status and code. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages from a 422, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) out[d.field] = d.message;
    return out;
  }
}

/** Called when the server rejects our token, so the app can log out. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects on NETWORK failure — server down, DNS, CORS block.
    // An HTTP 500 is a successful fetch with an unhappy status.
    throw new ApiError(
      'Cannot reach the bank server. Is it running on ' + BASE_URL + '?',
      0,
      'NETWORK_ERROR',
    );
  }

  const payload = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const err = payload as ApiErrorBody | null;

    // One place decides what an expired session means for the whole app.
    if (res.status === 401 && auth) {
      tokenStore.clear();
      onUnauthorized?.();
    }

    throw new ApiError(
      err?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.details,
    );
  }

  return payload as T;
}

export const api = {
  health: () => request<{ success: boolean; bank: string; bankCode: string }>('/health', { auth: false }),

  // ---- Auth ----
  register: (input: {
    email: string; password: string; firstName: string; lastName: string; phone: string;
  }) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: input, auth: false }),

  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: input, auth: false }),

  me: () => request<{ success: true; customer: Customer }>('/api/auth/me'),

  // ---- KYC ----
  submitBvn: (input: { bvn: string; dob: string }) =>
    request<{ success: true; message: string }>('/api/kyc/bvn', { method: 'POST', body: input }),

  submitNin: (input: { nin: string; dob: string }) =>
    request<{ success: true; message: string }>('/api/kyc/nin', { method: 'POST', body: input }),

  kycStatus: () => request<{ success: true; kyc: KycStatus }>('/api/kyc/status'),

  // ---- Account ----
  createAccount: () =>
    request<{ success: true; message: string; balance: number | null }>('/api/account', { method: 'POST' }),

  getAccount: () => request<{ success: true; account: Account }>('/api/account'),

  // ---- Transfers ----
  nameEnquiry: (accountNumber: string) =>
    request<{ success: true } & NameEnquiry>(`/api/transfer/name-enquiry/${accountNumber}`),

  transfer: (input: { to: string; amount: number; narration?: string }) =>
    request<{ success: true; transfer: TransferResult }>('/api/transfer', { method: 'POST', body: input }),

  transactionStatus: (reference: string) =>
    request<{ success: true; transaction: Transaction }>(`/api/transfer/status/${reference}`),

  // ---- History ----
  transactions: (params: { page?: number; limit?: number; direction?: 'DEBIT' | 'CREDIT' } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.direction) q.set('direction', params.direction);
    const qs = q.toString();
    return request<{ success: true; transactions: Transaction[]; pagination: Pagination }>(
      `/api/transactions${qs ? `?${qs}` : ''}`,
    );
  },

  summary: () => request<{ success: true; summary: TransactionSummary }>('/api/transactions/summary'),
};
