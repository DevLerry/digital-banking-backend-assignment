import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth.js';
import { nibss } from '../../nibss/client.js';
import { AppError } from '../../utils/AppError.js';
import { transferSchema } from './transfer.schemas.js';
import { nameEnquiry, transferFunds } from './transfer.service.js';
import { TransactionModel } from '../../models/Transaction.js';

export const transferRouter = Router();
transferRouter.use(requireAuth);

const accountNumberSchema = z.string().regex(/^\d{10}$/, 'Account number must be 10 digits');

/** GET /api/transfer/name-enquiry/:accountNumber — who am I about to pay? */
transferRouter.get('/name-enquiry/:accountNumber', async (req, res) => {
  const accountNumber = accountNumberSchema.parse(req.params.accountNumber);
  res.json({ success: true, ...(await nameEnquiry(accountNumber)) });
});

/** POST /api/transfer — move money. Sender comes from the token, never the body. */
transferRouter.post('/', async (req, res) => {
  const input = transferSchema.parse(req.body);
  const result = await transferFunds(req.customerId!, input);
  res.status(201).json({ success: true, message: 'Transfer successful', transfer: result });
});

/**
 * GET /api/transfer/status/:reference — transaction status check.
 *
 * OWNERSHIP GUARD: we first confirm this reference appears in the CALLER'S own
 * ledger. Without that check any customer could read any transaction in the
 * bank simply by guessing a reference (they are timestamp-based and therefore
 * very guessable). Requirement 4 again.
 */
transferRouter.get('/status/:reference', async (req, res) => {
  const reference = String(req.params.reference);

  const owned = await TransactionModel.findOne({ reference, customerId: req.customerId }).lean();
  if (!owned) throw AppError.notFound('Transaction not found in your history');

  const upstream = await nibss.getTransaction(reference);

  res.json({
    success: true,
    transaction: {
      reference,
      status: upstream.status ?? owned.status,
      amount: upstream.amount ?? owned.amountKobo / 100,
      from: upstream.senderAccount,
      to: upstream.receiverAccount,
      direction: owned.direction,
      scope: owned.scope,
      createdAt: upstream.createdAt ?? owned.createdAt,
    },
  });
});
