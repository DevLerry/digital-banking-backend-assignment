import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

/**
 * `mongodb+srv://` URIs require a DNS **SRV** lookup to discover the cluster's
 * replica-set members. Node resolves DNS through the OS-configured servers,
 * and some ISP resolvers answer SRV queries slowly or not at all — which
 * surfaces as a baffling `querySrv ECONNREFUSED` that looks like a Mongo
 * problem but is really a networking one.
 *
 * Pointing Node at a known-good public resolver removes that failure mode.
 * Configurable, because hard-coding someone else's DNS is a decision the
 * deployment environment should be able to override.
 */
if (env.DNS_SERVERS) {
  const servers = env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (servers.length) {
    dns.setServers(servers);
    console.log(`[dns] using resolvers: ${servers.join(', ')}`);
  }
}

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15_000,
  });
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('[db] disconnected');
}
