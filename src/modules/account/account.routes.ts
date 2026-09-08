import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { createAccountForCustomer, getMyAccount } from './account.service.js';

export const accountRouter = Router();

// Applied to the whole router, so no route added later can be left public.
accountRouter.use(requireAuth);

/** POST /api/account — open this customer's one and only account. */
accountRouter.post('/', async (req, res) => {
  const result = await createAccountForCustomer(req.customerId!);
  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    ...result,
  });
});

/**
 * GET /api/account — the caller's own account and live balance.
 *
 * Note there is NO :accountNumber parameter. The account is looked up from
 * req.customerId, which came from a signed token. A customer cannot ask for
 * an account that isn't theirs, because there is no way to name one.
 */
accountRouter.get('/', async (req, res) => {
  res.json({ success: true, account: await getMyAccount(req.customerId!) });
});
