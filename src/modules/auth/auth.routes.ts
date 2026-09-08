import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { getCustomerById, loginCustomer, registerCustomer } from './auth.service.js';

export const authRouter = Router();

/** POST /api/auth/register — create a customer of OUR bank (no KYC yet). */
authRouter.post('/register', async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerCustomer(input);
  res.status(201).json({ success: true, message: 'Registration successful', ...result });
});

/** POST /api/auth/login */
authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await loginCustomer(input);
  res.json({ success: true, message: 'Login successful', ...result });
});

/** GET /api/auth/me — who am I? Proves the token works. */
authRouter.get('/me', requireAuth, async (req, res) => {
  const customer = await getCustomerById(req.customerId!);
  res.json({ success: true, customer });
});
