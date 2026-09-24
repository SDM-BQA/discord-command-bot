import type { NextFunction, Request, Response } from "express";
import { verifyKey } from "discord-interactions";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// Discord signs every request; a captured request replayed later still has a valid signature,
// so we also refuse anything whose signed timestamp is too far from now.
const MAX_TIMESTAMP_AGE_SECONDS = 5 * 60;

export async function verifyDiscordSignature(req: Request, res: Response, next: NextFunction): Promise<void> {
  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");
  const rawBody: unknown = req.body;

  const reject = (reason: string) => {
    logger.warn({ reason, ip: req.ip }, "rejected interaction request");
    res.status(401).json({ error: "invalid request signature" });
  };

  if (!signature || !timestamp || !Buffer.isBuffer(rawBody)) {
    return reject("missing signature, timestamp or body");
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > MAX_TIMESTAMP_AGE_SECONDS) {
    return reject("timestamp outside allowed window");
  }

  // Must be the exact bytes Discord sent: re-serialized JSON would not match the signature.
  const isValid = await verifyKey(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  if (!isValid) {
    return reject("signature mismatch");
  }

  next();
}
