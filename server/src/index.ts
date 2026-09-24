import { env } from "./config/env";
import { logger } from "./utils/logger";
import { createApp } from "./app";

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "server started");
});

// Render sends SIGTERM on every deploy; finish in-flight requests before exiting.
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  server.close(() => process.exit(0));
});
