import { env } from '../config/env.js';
import { NibssError } from './errors.js';

/**
 * LAYER 1 AUTH: our whole bank authenticating to NIBSS.
 *
 * We observed that a NIBSS token carries exp - iat = 3600, i.e. it dies after
 * one hour. So we cannot fetch once at startup; we cache and refresh.
 */

interface CachedToken {
  token: string;
  /** Unix ms at which the token stops being valid. */
  expiresAtMs: number;
}

let cache: CachedToken | null = null;

/**
 * Holds the in-flight refresh, if one is happening.
 *
 * Why: without this, ten simultaneous requests arriving on an expired token
 * would fire ten identical /auth/token calls (a "thundering herd"). By storing
 * the *promise*, the first caller starts the refresh and the other nine await
 * that same promise. One network call, ten happy callers.
 */
let inFlight: Promise<string> | null = null;

/** Refresh this many ms BEFORE actual expiry, so a token can't die mid-request. */
const REFRESH_SKEW_MS = 60_000;

/** Read `exp` out of a JWT payload without verifying the signature. */
function readJwtExpiryMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function fetchFreshToken(): Promise<string> {
  if (!env.NIBSS_API_KEY || !env.NIBSS_API_SECRET) {
    throw new NibssError(
      'NIBSS credentials missing. Set NIBSS_API_KEY and NIBSS_API_SECRET in .env',
      500,
      null,
      '/api/auth/token',
    );
  }

  const res = await fetch(`${env.NIBSS_BASE_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: env.NIBSS_API_KEY, apiSecret: env.NIBSS_API_SECRET }),
  });

  const body = (await res.json().catch(() => null)) as { token?: string } | null;

  if (!res.ok || !body?.token) {
    throw new NibssError('Failed to obtain NIBSS token', res.status, body, '/api/auth/token');
  }

  const expiryMs = readJwtExpiryMs(body.token);
  cache = {
    token: body.token,
    // Fall back to 55 minutes if the token has no readable exp claim.
    expiresAtMs: expiryMs ?? Date.now() + 55 * 60_000,
  };

  return body.token;
}

/** Returns a valid NIBSS bearer token, refreshing only when necessary. */
export async function getNibssToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAtMs - REFRESH_SKEW_MS) {
    return cache.token;
  }
  if (inFlight) return inFlight;

  inFlight = fetchFreshToken().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Force the next call to fetch a new token. Used after an unexpected 401. */
export function invalidateNibssToken(): void {
  cache = null;
}
