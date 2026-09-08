import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { historyQuerySchema } from './history.schemas.js';
import { getTransactionHistory, getTransactionSummary } from './history.service.js';

export const historyRouter = Router();
historyRouter.use(requireAuth);

/**
 * GET /api/transactions — the caller's own transaction history.
 *
 * As with the account route, there is deliberately NO :customerId parameter.
 * The only history any caller can request is their own.
 */
historyRouter.get('/', async (req, res) => {
  const query = historyQuerySchema.parse(req.query);
  res.json({ success: true, ...(await getTransactionHistory(req.customerId!, query)) });
});

/** GET /api/transactions/summary — totals sent and received. */
historyRouter.get('/summary', async (req, res) => {
  res.json({ success: true, summary: await getTransactionSummary(req.customerId!) });
});
