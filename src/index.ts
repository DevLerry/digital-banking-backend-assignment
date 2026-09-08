import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/mongoose.js';

/**
 * Boot order matters: connect to the database FIRST, and only start accepting
 * HTTP traffic once it succeeds. Starting the server first would mean serving
 * requests we cannot possibly fulfil — and returning 500s to real users while
 * the process looks "up" to your monitoring.
 */
async function main() {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[http] listening on http://localhost:${env.PORT}`);
  });

  // Graceful shutdown: stop taking new requests, finish in-flight ones, then
  // close the DB. Without this, a deploy can cut a transfer off mid-flight.
  const shutdown = async (signal: string) => {
    console.log(`\n[app] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[app] failed to start:', err);
  process.exit(1);
});
