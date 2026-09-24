// The slash commands we register with Discord. Handlers match on these names, so they are exported as constants.

export const CommandName = {
  Report: "report",
  Status: "status",
} as const;

// Discord's numeric codes for option types and command contexts.
const OPTION_TYPE_STRING = 3;
const CONTEXT_GUILD = 0; // usable in servers only, not in DMs

export const REPORT_TEXT_MAX_LENGTH = 1000;

export const commandDefinitions = [
  {
    name: CommandName.Report,
    description: "Report an issue to the team",
    contexts: [CONTEXT_GUILD],
    options: [
      {
        type: OPTION_TYPE_STRING,
        name: "text",
        description: "What's wrong?",
        required: true,
        max_length: REPORT_TEXT_MAX_LENGTH,
      },
    ],
  },
  {
    name: CommandName.Status,
    description: "Show the bot's status for this server",
    contexts: [CONTEXT_GUILD],
  },
];
