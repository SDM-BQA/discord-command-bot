/** A non-2xx response from Discord's REST API, with what the retry logic needs to decide what to do next. */
export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly responseBody: string,
    readonly retryAfterMs?: number,
  ) {
    super(`Discord API ${status} on ${path}`);
    this.name = "DiscordApiError";
  }
}
