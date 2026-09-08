import { z } from 'zod';

/**
 * Query parameters arrive as strings, always. `z.coerce` converts them to
 * numbers before validating, so `?page=2` becomes the number 2.
 *
 * Note the ceiling on `limit`: without it, `?limit=999999999` lets any caller
 * ask the database for everything at once — an easy denial-of-service, and a
 * classic oversight in paginated APIs.
 */
export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['DEBIT', 'CREDIT']).optional(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED']).optional(),
  scope: z.enum(['INTRA', 'INTER']).optional(),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
