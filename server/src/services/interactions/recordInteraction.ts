import type { Interaction as InteractionRow, Priority } from "../../generated/prisma/client";
import { prisma } from "../../db/prisma";
import { isUniqueViolation } from "../../utils/prismaErrors";

export type NewInteraction = {
  discordId: string;
  guildId: string;
  type: number;
  commandName: string;
  userId: string;
  userName: string;
  channelId: string;
  token: string;
  input?: string;
  priority?: Priority;
  matchedRuleId?: number | null;
};

export type RecordResult = { duplicate: false; interaction: InteractionRow } | { duplicate: true };

/**
 * Inserts the interaction. The unique constraint on discordId is the dedup: if the same interaction is
 * delivered again, the insert fails and the caller must do nothing further. Checking first and then
 * inserting would race when two copies arrive together; letting the database decide cannot.
 */
export async function recordInteraction(data: NewInteraction): Promise<RecordResult> {
  try {
    const interaction = await prisma.interaction.create({ data });
    return { duplicate: false, interaction };
  } catch (err) {
    if (isUniqueViolation(err)) return { duplicate: true };
    throw err;
  }
}
