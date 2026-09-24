import { env } from "../config/env";
import { commandDefinitions } from "../commands/definitions";
import { discordRequest } from "../services/discord/api";

// Run with `npm run register-commands`. PUT replaces the full global command list, so re-running is safe.

// View Channel (1024) + Send Messages (2048) + Embed Links (16384): just what the bot needs to post report cards.
const BOT_PERMISSIONS = 1024 + 2048 + 16384;

async function main() {
  const registered = await discordRequest<{ name: string }[]>(
    "PUT",
    `/applications/${env.DISCORD_APPLICATION_ID}/commands`,
    commandDefinitions,
  );
  console.log(`Registered ${registered.length} global commands: ${registered.map((c) => `/${c.name}`).join(", ")}`);

  const invite = new URL("https://discord.com/oauth2/authorize");
  invite.searchParams.set("client_id", env.DISCORD_APPLICATION_ID);
  invite.searchParams.set("scope", "bot applications.commands");
  invite.searchParams.set("permissions", String(BOT_PERMISSIONS));
  console.log(`\nInvite the bot to a server:\n${invite}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "responseBody" in err) console.error(err.responseBody);
  process.exit(1);
});
