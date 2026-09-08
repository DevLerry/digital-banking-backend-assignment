import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * The gate. Any route mounted behind this is guaranteed to have a verified
 * `req.customerId`, so handlers never need to ask "is this person logged in?"
 *
 * REQUIREMENT 4 depends entirely on this: `req.customerId` comes from a
 * cryptographically signed token, NOT from the request body or a query param.
 * A caller cannot forge it without our JWT_SECRET.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing Bearer token'));
  }

  const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
  req.customerId = payload.sub;
  req.customerEmail = payload.email;
  next();
}
