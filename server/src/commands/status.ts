import { prisma } from "../db/prisma";
import type { GuildWithConfig } from "../services/guilds/guildService";
import { CommandName } from "./definitions";
import { ephemeralMessage } from "../utils/discordResponses";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function statusReply(guild: GuildWithConfig) {
  const reportsToday = await prisma.interaction.count({
    where: { guildId: guild.id, commandName: CommandName.Report, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  });

  const lines = [
    "**Bot status**",
    guild.connectedAt
      ? "✅ Server connected"
      : "⚠️ Server not connected yet: an admin needs to set it up in the dashboard",
    `📢 Report channel: ${guild.postChannelId ? `<#${guild.postChannelId}>` : "not set"}`,
    // Only whether a mirror exists; the webhook URL itself is a secret.
    `🔁 Mirror: ${guild.mirrorWebhookUrl ? "configured" : "not configured"}`,
    `📝 Reports in the last 24h: ${reportsToday}`,
  ];
  return ephemeralMessage(lines.join("\n"));
}
