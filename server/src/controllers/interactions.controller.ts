import type { Request, Response } from "express";
import { InteractionType } from "discord-interactions";
import { parseInteraction } from "../services/interactions/parseInteraction";
import { handleCommand } from "../services/interactions/handleCommand";
import { respondWithinBudget } from "../services/interactions/respondWithinBudget";
import { COMMAND_FAILED_TEXT, ephemeralMessage, pong } from "../utils/discordResponses";
import { logger } from "../utils/logger";

// Runs only after verifyDiscordSignature, so req.body is the raw, verified Buffer.
export async function handleInteraction(req: Request, res: Response): Promise<void> {
  const interaction = parseInteraction(req.body as Buffer);
  if (!interaction) {
    logger.warn("signed request with invalid interaction payload");
    res.status(400).json({ error: "invalid interaction payload" });
    return;
  }

  const log = logger.child({ interactionId: interaction.id, interactionType: interaction.type });

  try {
    switch (interaction.type) {
      case InteractionType.PING:
        log.info("ping received");
        res.json(pong());
        return;
      case InteractionType.APPLICATION_COMMAND: {
        const startedAt = Date.now();
        // handleCommand has no token-free slow path: without a token it returns immediately, so "" is never used.
        await respondWithinBudget(res, handleCommand(interaction, log), { token: interaction.token ?? "", log });
        // Includes any deferred follow-up; a "budget exceeded" warning shows when Discord got "thinking…" first.
        log.info({ durationMs: Date.now() - startedAt }, "command handled");
        return;
      }
      default:
        log.warn("unhandled interaction type");
        res.json(ephemeralMessage("Sorry, I can't handle that yet."));
    }
  } catch (err) {
    // Failed within the response budget (most likely the database is unreachable): tell the user now
    // instead of letting Discord time out; they can simply run the command again.
    log.error({ err }, "failed to handle interaction");
    res.json(ephemeralMessage(COMMAND_FAILED_TEXT));
  }
}
