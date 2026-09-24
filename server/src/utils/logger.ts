import pino from "pino";
import { env, isProduction } from "../config/env";

// Any field with one of these names is replaced with "[REDACTED]", at the top level or one level deep.
const secretKeys = ["token", "botToken", "password", "authorization", "cookie", "webhookUrl", "mirrorWebhookUrl"];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: secretKeys.flatMap((key) => [key, `*.${key}`]),
    censor: "[REDACTED]",
  },
  // Render collects stdout, so production logs stay as JSON lines; pretty output is for local dev only.
  transport: isProduction ? undefined : { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } },
});
