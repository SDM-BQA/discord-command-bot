import { env } from "../../config/env";
import type { MessageData } from "../../utils/discordResponses";
import { discordRequest } from "./api";

// Follow-ups to an interaction are authorised by its token (valid 15 minutes), not by the bot token.

/** Replaces the "Bot is thinking…" message (or the original reply) with new content. */
export function editOriginalResponse(token: string, data: MessageData): Promise<unknown> {
  // Visibility (ephemeral or not) was fixed by the first response, so only the content is sent.
  return discordRequest("PATCH", `/webhooks/${env.DISCORD_APPLICATION_ID}/${token}/messages/@original`, {
    content: data.content,
  });
}
