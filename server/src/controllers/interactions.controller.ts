import type { Request, Response } from "express";
import { InteractionType } from "discord-interactions";
import { parseInteraction } from "../services/interactions/parseInteraction";
import { ephemeralMessage, pong } from "../utils/discordResponses";
import { logger } from "../utils/logger";

// Runs only after verifyDiscordSignature, so req.body is the raw, verified Buffer.
export function handleInteraction(req: Request, res: Response): void {
  const interaction = parseInteraction(req.body as Buffer);
  if (!interaction) {
    logger.warn("signed request with invalid interaction payload");
    res.status(400).json({ error: "invalid interaction payload" });
    return;
  }

  const log = logger.child({ interactionId: interaction.id, interactionType: interaction.type });

  if (interaction.type === InteractionType.PING) {
    log.info("ping received");
    res.json(pong());
    return;
  }

  log.warn("unhandled interaction type");
  res.json(ephemeralMessage("Sorry, I can't handle that yet."));
}
