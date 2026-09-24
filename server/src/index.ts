import { env } from "./config/env";
import { logger } from "./utils/logger";
import { prisma } from "./db/prisma";
import { createApp } from "./app";

/**
 * Pays one-time startup costs (Prisma init, first DB connection) before we accept traffic. On Render's
 * 0.1 CPU the first query froze the event loop for ~1.5s, long enough to defeat the response budget and
 * risk Discord's 3s limit. Render only routes traffic once /health answers, so no command hits a cold server.
 */
async function warmUp() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info({ durationMs: Date.now() - startedAt }, "database warm-up done");
  } catch (err) {
    // Start anyway: commands will fail fast with an explicit error, which beats not serving at all.
    logger.error({ err, durationMs: Date.now() - startedAt }, "database warm-up failed");
  }
}

async function main() {
  await warmUp();

  const server = createApp().listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "server started");
  });

  // Render sends SIGTERM on every deploy; finish in-flight requests before exiting.
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down");
    server.close(() => process.exit(0));
  });
}

void main();
