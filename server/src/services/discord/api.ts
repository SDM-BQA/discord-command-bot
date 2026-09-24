import { env } from "../../config/env";
import { DiscordApiError } from "../../utils/errors";

// The only place that talks to Discord's REST API, so auth, timeouts and error handling live in one spot.

const DISCORD_API = "https://discord.com/api/v10";
const REQUEST_TIMEOUT_MS = 5000;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function discordRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    // Discord's error bodies describe the problem (e.g. missing permission) and never echo our token.
    const text = (await res.text()).slice(0, 500);
    const retryAfterSeconds = Number(res.headers.get("retry-after"));
    const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined;
    throw new DiscordApiError(res.status, path, text, retryAfterMs);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
