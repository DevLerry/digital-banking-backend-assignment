import { z } from 'zod';

/**
 * Note what is ABSENT: there is no `from` field.
 *
 * The sender is never taken from the request body — it is derived from the
 * authenticated token. A caller therefore has no way to express "send money
 * from someone else's account". See OWNERSHIP in transfer.service.ts.
 */
export const transferSchema = z.object({
  to: z.string().regex(/^\d{10}$/, 'Recipient account number must be 10 digits'),
  amount: z
    .number()
    .positive('Amount must be greater than zero')
    .max(1_000_000, 'Amount exceeds the single-transfer limit of N1,000,000'),
  narration: z.string().max(100, 'Narration must be 100 characters or fewer').optional(),
});

export type TransferInput = z.infer<typeof transferSchema>;
