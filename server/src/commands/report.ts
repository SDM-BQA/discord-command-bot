import type { Interaction as InteractionRow } from "../generated/prisma/client";
import { ephemeralMessage } from "../utils/discordResponses";

export function reportReply(record: InteractionRow) {
  return ephemeralMessage(`📝 Report #${record.id} recorded — priority **${record.priority}**.`);
}
