import { Priority } from "../generated/prisma/client";
import { CommandName } from "../commands/definitions";

// What a guild starts with the first time we see it, so the bot behaves sensibly before an admin configures it.

export const DEFAULT_COMMAND_CONFIGS = [
  { commandName: CommandName.Report },
  { commandName: CommandName.Status, postToChannel: false, mirrorEnabled: false },
];

export const DEFAULT_RULES = [
  { keyword: "payment", priority: Priority.HIGH },
  { keyword: "outage", priority: Priority.HIGH },
  { keyword: "urgent", priority: Priority.HIGH },
  { keyword: "bug", priority: Priority.MEDIUM },
  { keyword: "error", priority: Priority.MEDIUM },
].map((rule, index) => ({ ...rule, commandName: CommandName.Report, position: index }));
