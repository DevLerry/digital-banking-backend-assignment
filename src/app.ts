import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { kycRouter } from './modules/kyc/kyc.routes.js';
import { accountRouter } from './modules/account/account.routes.js';
import { transferRouter } from './modules/transfer/transfer.routes.js';
import { historyRouter } from './modules/history/history.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      bank: process.env.BANK_NAME ?? 'OUR Bank',
      bankCode: process.env.NIBSS_BANK_CODE ?? '210',
      environment: env.NODE_ENV,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/kyc', kycRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/transfer', transferRouter);
  app.use('/api/transactions', historyRouter);

  // ---- more feature routes get mounted here as we build them ----

  // Any URL that matched nothing above is a 404. Declared AFTER all routes,
  // because Express matches middleware strictly in the order it was registered.
  app.use((req, _res, next) => {
    next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  // The error handler must be LAST. It only receives errors that flowed past
  // everything registered before it.
  app.use(errorHandler);

  return app;
}
