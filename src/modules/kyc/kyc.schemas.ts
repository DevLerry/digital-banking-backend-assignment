import { z } from 'zod';

/**
 * The customer sends only what we DON'T already know.
 *
 * NIBSS's insertBvn needs bvn, firstName, lastName, dob and phone — but three
 * of those are already on the Customer record from registration. Asking for
 * them again invites a typo that fails a name match for no reason. The service
 * layer fills them in from the database.
 */

const elevenDigits = /^\d{11}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const submitBvnSchema = z.object({
  bvn: z.string().regex(elevenDigits, 'BVN must be exactly 11 digits'),
  dob: z.string().regex(isoDate, 'Date of birth must be in YYYY-MM-DD format'),
});

export const submitNinSchema = z.object({
  nin: z.string().regex(elevenDigits, 'NIN must be exactly 11 digits'),
  dob: z.string().regex(isoDate, 'Date of birth must be in YYYY-MM-DD format'),
});

export type SubmitBvnInput = z.infer<typeof submitBvnSchema>;
export type SubmitNinInput = z.infer<typeof submitNinSchema>;
