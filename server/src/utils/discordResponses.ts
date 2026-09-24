import { InteractionResponseFlags, InteractionResponseType } from "discord-interactions";

// Builders for the JSON bodies we send back to Discord, so response shapes live in one place.

export function pong() {
  return { type: InteractionResponseType.PONG };
}

/** A reply only the user who ran the command can see. */
export function ephemeralMessage(content: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: InteractionResponseFlags.EPHEMERAL },
  };
}
