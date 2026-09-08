import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { NibssError } from '../nibss/errors.js';
import { env } from '../config/env.js';

/**
 * THE SINGLE PLACE ERRORS BECOME HTTP RESPONSES.
 *
 * Express recognises a middleware with FOUR arguments as an error handler.
 * That fourth parameter `_next` is unused but must exist — remove it and
 * Express silently treats this as a normal middleware and your errors vanish.
 *
 * Because Express 5 automatically forwards rejected promises from async route
 * handlers, every failure in the app - thrown or rejected - lands here.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // 1. Business rules we broke on purpose.
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // 2. Request body failed validation. Report WHICH field, so the client can fix it.
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  // 3. The upstream bank rails failed. 502 = "I am a gateway and my upstream broke",
  //    which is honest: the fault is not the caller's.
  if (err instanceof NibssError) {
    console.error('[nibss]', err.endpoint, err.status, JSON.stringify(err.body));
    return res.status(502).json({
      success: false,
      code: 'UPSTREAM_ERROR',
      message: `Bank rails error: ${err.message}`,
    });
  }

  // 4. Mongo duplicate-key. This is how our unique indexes surface —
  //    e.g. the one-account-per-customer rule losing a race.
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE',
      message: 'That record already exists',
    });
  }

  // 5. Anything else is a real bug. Log everything, tell the user nothing.
  //    Leaking stack traces hands an attacker a map of your codebase.
  console.error('[unhandled]', err);
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong on our end',
    ...(env.NODE_ENV === 'development' ? { debug: String(err) } : {}),
  });
}
