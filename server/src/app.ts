import express from "express";
import { healthRouter } from "./routes/health.routes";
import { interactionsRouter } from "./routes/interactions.routes";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Render puts one proxy in front of us; without this, req.ip is the proxy's address.
  app.set("trust proxy", 1);

  // No global express.json(): /api/interactions must receive the raw body for signature checks.
  app.use("/health", healthRouter);
  app.use("/api/interactions", interactionsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
