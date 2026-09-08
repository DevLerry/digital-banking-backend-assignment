import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

/**
 * LAYER 2 AUTH: an individual customer authenticating to OUR bank.
 *
 * Completely separate from the NIBSS token in src/nibss/token.ts, which is our
 * whole bank authenticating to the rails. Different secret, different lifetime,
 * different audience. Never mix them.
 */

export interface AccessTokenPayload {
  /** `sub` (subject) is the JWT standard claim for "who this token is about". */
  sub: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.sub) {
      throw AppError.unauthorized('Malformed token');
    }
    return { sub: String(decoded.sub), email: String((decoded as { email?: string }).email ?? '') };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Session expired, please log in again');
    }
    throw AppError.unauthorized('Invalid token');
  }
}
