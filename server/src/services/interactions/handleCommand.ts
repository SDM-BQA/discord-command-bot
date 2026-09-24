import type { Logger } from "pino";
import { CommandName } from "../../commands/definitions";
import { reportReply } from "../../commands/report";
import { statusReply } from "../../commands/status";
import { getInvokingUser, getStringOption, type Interaction } from "../../types/discord";
import { ephemeralMessage } from "../../utils/discordResponses";
import { getOrCreateGuild } from "../guilds/guildService";
import { applyRules } from "./applyRules";
import { recordInteraction } from "./recordInteraction";

/** Handles a slash command (type 2). Everything here must finish well inside Discord's 3-second window. */
export async function handleCommand(interaction: Interaction, log: Logger) {
  const commandName = interaction.data?.name;
  const user = getInvokingUser(interaction);
  const { guild_id: guildId, channel_id: channelId, token } = interaction;

  if (!guildId || !channelId) return ephemeralMessage("This bot only works inside a server.");
  if (!commandName || !user || !token) return ephemeralMessage("That command looks incomplete.");

  const guild = await getOrCreateGuild(guildId);
  const config = guild.commandConfigs.find((c) => c.commandName === commandName);
  if (!config) {
    log.warn({ commandName }, "command has no config");
    return ephemeralMessage("Unknown command.");
  }

  const input = commandName === CommandName.Report ? getStringOption(interaction, "text")?.trim() : undefined;
  const rule = input ? applyRules(guild.rules, commandName, input) : undefined;

  // Recorded before anything else happens (even for disabled commands) so the dashboard shows every attempt.
  const result = await recordInteraction({
    discordId: interaction.id,
    guildId,
    type: interaction.type,
    commandName,
    userId: user.id,
    userName: user.name,
    channelId,
    token,
    input,
    priority: rule?.priority,
    matchedRuleId: rule?.matchedRuleId,
  });

  if (result.duplicate) {
    log.warn("duplicate interaction ignored");
    return ephemeralMessage("This command was already processed.");
  }
  log.info({ recordId: result.interaction.id, commandName, priority: rule?.priority }, "interaction recorded");

  if (!config.enabled) return ephemeralMessage(`/${commandName} is disabled on this server.`);

  switch (commandName) {
    case CommandName.Report:
      return reportReply(result.interaction);
    case CommandName.Status:
      return statusReply(guild);
    default:
      return ephemeralMessage("Unknown command.");
  }
}
