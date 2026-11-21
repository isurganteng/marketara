import { app } from './app';
import { env } from './config';
import { client } from './db';

const server = Bun.serve({
  port: env.port,
  fetch: app.fetch,
  maxRequestBodySize: 10 * 1024 * 1024,
});

console.log(`Marketara API listening on http://localhost:${server.port} (${env.nodeEnv})`);

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  server.stop();
  await client.end({ timeout: 5 });
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
