import { InteractionResponseFlags, InteractionResponseType } from "discord-interactions";

// Builders for the JSON bodies we send back to Discord, so response shapes live in one place.

export type MessageData = { content: string; flags?: number };
export type MessageResponse = { type: InteractionResponseType; data: MessageData };

export const COMMAND_FAILED_TEXT = "⚠️ Something went wrong handling your command. Please try again.";

export function pong() {
  return { type: InteractionResponseType.PONG };
}

/** A reply only the user who ran the command can see. */
export function ephemeralMessage(content: string): MessageResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: InteractionResponseFlags.EPHEMERAL },
  };
}

/**
 * "Bot is thinking…": buys up to 15 minutes to edit in the real reply. Visibility is fixed here and cannot
 * be changed by the later edit, so it must match the reply we intend to send.
 */
export function deferredResponse(ephemeral: boolean) {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: ephemeral ? { flags: InteractionResponseFlags.EPHEMERAL } : {},
  };
}
