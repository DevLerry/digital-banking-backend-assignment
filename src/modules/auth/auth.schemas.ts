import { z } from 'zod';

/**
 * Validation lives at the EDGE of the system. Once a request passes through
 * here, every layer beneath it can trust the shape of the data absolutely and
 * stop re-checking. Untrusted input is converted to trusted input exactly once,
 * in one place.
 */

export const registerSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  phone: z
    .string()
    .regex(/^0\d{10}$/, 'Phone must be 11 digits starting with 0, e.g. 08012345678'),
});

export const loginSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
