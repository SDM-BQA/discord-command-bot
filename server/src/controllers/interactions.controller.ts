import type { Request, Response } from "express";
import { InteractionType } from "discord-interactions";
import { parseInteraction } from "../services/interactions/parseInteraction";
import { handleCommand } from "../services/interactions/handleCommand";
import { ephemeralMessage, pong } from "../utils/discordResponses";
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
        res.json(await handleCommand(interaction, log));
        // Discord gives up after 3s; this is how we see how close we get.
        log.info({ durationMs: Date.now() - startedAt }, "command responded");
        return;
      }
      default:
        log.warn("unhandled interaction type");
        res.json(ephemeralMessage("Sorry, I can't handle that yet."));
    }
  } catch (err) {
    // Most likely the database is unreachable. Nothing was recorded, so say so honestly instead of
    // letting Discord time out; the user can simply run the command again.
    log.error({ err }, "failed to handle interaction");
    res.json(ephemeralMessage("⚠️ Something went wrong and your command was not recorded. Please try again."));
  }
}
