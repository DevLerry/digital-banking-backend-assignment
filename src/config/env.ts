import 'dotenv/config';
import { z } from 'zod';

/**
 * Validate environment variables ONCE, at boot.
 *
 * Why: `process.env.FOO` is `string | undefined` everywhere in TS, so without
 * this you sprinkle `!` or `?? ''` across the codebase and a missing var only
 * explodes at 2am on the one code path nobody tested. Validating here means the
 * app refuses to start with bad config, and everything downstream gets clean,
 * fully-typed values.
 */
const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  NIBSS_BASE_URL: z.string().url().default('https://nibssbyphoenix.onrender.com'),

  // Comma-separated DNS resolvers. Needed when the local/ISP resolver cannot
  // reliably answer the SRV lookup that mongodb+srv:// depends on.
  DNS_SERVERS: z.string().optional(),

  // Deliberately optional: these arrive by email AFTER we onboard the fintech.
  // We must be able to boot and build the app before they exist.
  NIBSS_API_KEY: z.string().optional(),
  NIBSS_API_SECRET: z.string().optional(),

  // Our own bank identity on the rails. Used to tell an INTRA-bank transfer
  // (same bankCode) from an INTER-bank one.
  NIBSS_BANK_CODE: z.string().default('210'),
  BANK_NAME: z.string().default('OUR Bank'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

/** True once NIBSS has emailed us credentials and they're in .env. */
export const hasNibssCredentials = Boolean(env.NIBSS_API_KEY && env.NIBSS_API_SECRET);
