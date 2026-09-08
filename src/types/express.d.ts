/**
 * Declaration merging: we're adding fields to Express's own Request interface.
 *
 * Why: `requireAuth` attaches the logged-in customer to the request so every
 * downstream handler can read it. Without this file, `req.customerId` is a
 * TypeScript error. With it, the whole app gets autocomplete for it.
 */
declare global {
  namespace Express {
    interface Request {
      customerId?: string;
      customerEmail?: string;
    }
  }
}

export {};
