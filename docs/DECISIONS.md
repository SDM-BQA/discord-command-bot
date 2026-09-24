# Decisions

Format: context → choice → trade-off. Status is **Proposed** until confirmed.

## D1. Webhook interactions, not a gateway bot — Accepted

- **Context:** Brief requires an Interactions Endpoint; a websocket bot needs an always-on process.
- **Choice:** HTTP interactions only. Bot token is used just for REST calls (list channels, post messages).
- **Trade-off:** Can't react to normal messages/events — not needed here.

## D2. Single deployment: Express serves API + built React app — Proposed

- **Context:** Free hosting, 2-day deadline, one service to keep warm.
- **Choice:** One Render web service. `/api/*` = backend, everything else = Vite build.
- **Trade-off:** Frontend and backend deploy together; fine at this size. Same origin also means plain httpOnly session cookies, no CORS.

## D3. Render free tier + uptime pinger — Proposed

- **Context:** Render free sleeps after ~15 min idle; a cold start takes far longer than Discord's 3s window, so the first command after idle would fail.
- **Choice:** Free pinger (e.g. UptimeRobot, 5-min interval) on `/health`. One always-on service fits within Render's free monthly hours.
- **Trade-off:** Depends on a third service; if the pinger stops, first command after idle fails. `/health` does not touch the DB, so it doesn't burn Neon compute.

## D4. Neon Postgres + Prisma — Proposed

- **Context:** Need a unique constraint for dedup and relational data (guilds, rules, interactions, actions).
- **Choice:** Neon free tier; pooled URL for the app, direct URL for migrations.
- **Why not MongoDB (my usual stack):** Mongo could work (unique indexes exist, Atlas is free), but the data is relational — guild → rules, guild → interactions → actions — and foreign keys guarantee no orphaned actions. Dedup is one atomic `INSERT ... ON CONFLICT DO NOTHING`, and a transaction saves an interaction with its pending actions together so a crash can't leave half-written state. Also the brief's suggested option.
- **Region:** Neon in Singapore (`ap-southeast-1`); Render must be in Singapore too. App↔DB is several round trips per command, app↔Discord only one or two, so co-locating app and DB matters most. Extra latency to Discord (US) is roughly 0.2–0.3s, well inside 3s.
- **New for me:** Prisma migrations (schema changes are explicit, unlike Mongoose where new fields just appear).
- **Trade-off:** Neon suspends idle compute; the first query after idle adds latency. Mitigation: the interaction handler keeps its pre-response DB work to one insert, and defers whenever the response isn't immediate.

## D5. Admin auth: single email/password admin, bot added via OAuth2 install link — Proposed

- **Context:** Reviewers need a throwaway admin login; they shouldn't need their own Discord account to log in.
- **Choice:** Admin credentials from env (bcrypt hash), httpOnly signed session cookie. "Connect server" uses Discord's OAuth2 bot-install URL (`scope=bot applications.commands`); the redirect returns `guild_id`, which we store, then list channels via the bot token for the admin to pick one.
- **Trade-off:** One admin account, no user management. Enough for the brief.

## D6. Reliability: actions table + in-process retry worker — Proposed

- **Context:** Mirror/AI/follow-ups must not be lost if briefly down.
- **Choice:** Each side effect is an `Action` row (`type`, `status`, `attempts`, `lastError`, `nextAttemptAt`). A `setInterval` worker retries due actions with exponential backoff, max N attempts, then `failed` (visible in dashboard). Worker also resumes pending rows on boot.
- **Trade-off:** In-process worker only runs while the service is up (kept warm by D3). The interaction token (used for the REPLY follow-up) expires after 15 min; if REPLY still hasn't succeeded by then it is marked FAILED, with no fallback. That's acceptable because CHANNEL_POST already puts the report in the channel.

## D7. Live log via polling — Proposed

- **Context:** Dashboard needs a "live" log.
- **Choice:** Poll the API every ~3s.
- **Trade-off:** Slightly wasteful vs SSE, but simpler and no connection issues on Render. Could switch to SSE later.

## D8. Mirror via Discord channel webhook — Accepted

- **Context:** Need a second channel; options were a webhook URL or the bot posting to another channel id.
- **Choice:** Per-guild webhook URL, write-only in the UI (masked), never logged.
- **Trade-off:** One more secret to protect, but the mirror keeps working even if the bot's permissions break, and the brief treats mirror URLs as secrets, which hints this is what they expect.

## D9. Rules drive behaviour, not just labels — Accepted

- **Context:** Brief says the app "acts on" commands and "applies a simple rule". A priority label alone doesn't change anything the bot does.
- **Choice:** Keyword → priority (first match wins), and each command has `mirrorMinPriority`, so e.g. only HIGH reports get mirrored.
- **Trade-off:** Slightly more config; in return the rule is demoable (`/report typo` → not mirrored, `/report payment down` → mirrored).
