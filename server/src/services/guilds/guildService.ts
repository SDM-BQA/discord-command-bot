import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../db/prisma";
import { DEFAULT_COMMAND_CONFIGS, DEFAULT_RULES } from "../../config/defaults";
import { isUniqueViolation } from "../../utils/prismaErrors";

const guildWithConfig = {
  commandConfigs: true,
  rules: { where: { enabled: true }, orderBy: { position: "asc" } },
} satisfies Prisma.GuildInclude;

export type GuildWithConfig = Prisma.GuildGetPayload<{ include: typeof guildWithConfig }>;

/**
 * Loads a guild with its command configs and enabled rules (one query on the hot path).
 * A guild we have never seen is created with default config, so commands work before an admin connects it.
 */
export async function getOrCreateGuild(guildId: string): Promise<GuildWithConfig> {
  const existing = await prisma.guild.findUnique({ where: { id: guildId }, include: guildWithConfig });
  if (existing) return existing;

  try {
    return await prisma.guild.create({
      data: {
        id: guildId,
        commandConfigs: { create: DEFAULT_COMMAND_CONFIGS },
        rules: { create: DEFAULT_RULES },
      },
      include: guildWithConfig,
    });
  } catch (err) {
    // Two first-ever commands from the same guild raced; the other one created it.
    if (isUniqueViolation(err)) {
      return prisma.guild.findUniqueOrThrow({ where: { id: guildId }, include: guildWithConfig });
    }
    throw err;
  }
}
