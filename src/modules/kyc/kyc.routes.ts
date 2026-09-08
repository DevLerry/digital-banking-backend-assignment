import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { submitBvnSchema, submitNinSchema } from './kyc.schemas.js';
import { getKycStatus, submitBvn, submitNin } from './kyc.service.js';

export const kycRouter = Router();

// Every KYC route requires a logged-in customer. Applying it to the whole
// router means a new route added below CANNOT accidentally be left public.
kycRouter.use(requireAuth);

/** POST /api/kyc/bvn */
kycRouter.post('/bvn', async (req, res) => {
  const input = submitBvnSchema.parse(req.body);
  const record = await submitBvn(req.customerId!, input);
  res.status(201).json({ success: true, message: 'BVN verified successfully', kyc: record });
});

/** POST /api/kyc/nin */
kycRouter.post('/nin', async (req, res) => {
  const input = submitNinSchema.parse(req.body);
  const record = await submitNin(req.customerId!, input);
  res.status(201).json({ success: true, message: 'NIN verified successfully', kyc: record });
});

/** GET /api/kyc/status */
kycRouter.get('/status', async (req, res) => {
  res.json({ success: true, kyc: await getKycStatus(req.customerId!) });
});
