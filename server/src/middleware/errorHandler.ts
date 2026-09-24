import { STATUS_CODES } from "node:http";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

// Body-parser errors (e.g. 413 too large, 400 bad encoding) carry a `status`; anything else is a bug → 500.
function statusOf(err: unknown): number {
  const status = (err as { status?: unknown })?.status;
  return typeof status === "number" && status >= 400 && status < 600 ? status : 500;
}

// Express recognises error handlers by their four parameters, so `_next` must stay.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = statusOf(err);
  if (status >= 500) {
    logger.error({ err, path: req.path }, "unhandled error");
  } else {
    logger.warn({ status, path: req.path }, "request rejected");
  }
  // Never echo internal error details to the client.
  res.status(status).json({ error: STATUS_CODES[status] ?? "error" });
}
