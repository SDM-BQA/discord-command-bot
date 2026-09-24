# Design

Status: **Agreed.** Changes to the design are made here first, then in code.

## 1. Components

```text
 Discord ──(signed POST)──▶  Express server (Render)  ──▶ Neon Postgres
    ▲                          │   ├─ /api/interactions  (Discord → us)
    │                          │   ├─ /api/*             (dashboard API, session auth)
    │                          │   ├─ /*                 (built React dashboard)
    │                          │   └─ retry worker       (setInterval, same process)
    │                          │
    └──(REST: follow-ups, channel posts, bot token)──────┘
                               └──▶ Mirror: Discord webhook in a second channel
```

One process, one deployment. The admin uses the dashboard; Discord users only use slash commands.

## 2. Commands

| Command | Input | Response | Side effects |
|---|---|---|---|
| `/report <text>` | `text`: string, required, max 1000 chars | Deferred, then follow-up: "Report #42 received — priority HIGH" | Rule applied; report posted to the configured channel; mirrored |
| `/status` | none | Immediate, ephemeral (only the caller sees it): server connected?, reports today, pending/failed actions | Recorded only |

Stretch: `/report` with no text opens a modal (type 9 response → type 5 MODAL_SUBMIT). The report message in the channel gets buttons like "Acknowledge" / "Resolve" (type 3 MESSAGE_COMPONENT).

## 3. Interaction flow

### 3.1 Synchronous part (must finish well under 3s)

```mermaid
sequenceDiagram
    participant D as Discord
    participant S as Server
    participant DB as Postgres
    D->>S: POST /api/interactions (raw body + signature headers)
    S->>S: 1. Verify Ed25519 signature → 401 if bad
    S->>S: 2. Check timestamp within 5 min → 401 if stale
    S->>S: 3. Parse JSON + validate shape → 400 if junk
    alt type 1 PING
        S-->>D: { type: 1 } PONG
    else command / component / modal
        S->>DB: 4. Load guild + command config + rules (upsert guild if unknown)
        S->>S: 5. Apply rule → priority
        S->>DB: 6. ONE transaction: insert Interaction (unique discordId) + its pending Actions
        alt duplicate discordId (insert skipped)
            S-->>D: ephemeral "already processed" — no side effects
        else new
            S-->>D: 7. /report → type 5 DEFERRED ; /status → type 4 message
            S->>S: 8. Kick off processing of this interaction's actions (async, after response)
        end
    end
```

Rules for this part:

- Verification happens on the raw bytes before any JSON parsing. Nothing about the request is trusted until step 1 passes.
- The only slow thing allowed before responding is the DB. No external HTTP calls before the response.
- If the DB is down at step 4/6, respond with an ephemeral error ("Couldn't record your report, please retry"). We can't queue it anywhere safe, so being honest is better than pretending.

### 3.2 Asynchronous part (after responding)

Each interaction creates **Action** rows. Each action runs independently, and one failing doesn't block the others:

| Action | What it does | Uses |
|---|---|---|
| `REPLY` | Edits the deferred "thinking…" message into the real reply | Interaction token (valid 15 min), no bot token needed |
| `CHANNEL_POST` | Posts the report card into the guild's configured channel | Bot token |
| `MIRROR` | Posts a notification to the mirror channel | Mirror webhook URL |
| `AI_TRIAGE` *(stretch)* | Summarize + tag the text via Groq | Groq API key |

Which actions get created depends on command config: `/status` creates none. `CHANNEL_POST` is skipped if no channel is configured, and `MIRROR` is skipped if no webhook is set, mirroring is disabled, or the priority is below the command's `mirrorMinPriority`. **This is where the rule changes what the bot does**, not just how the report is labelled.

### 3.3 Action lifecycle and retries

```text
PENDING ──claim──▶ PROCESSING ──ok──▶ SUCCEEDED
   ▲                   │
   └──retryable error──┘ (attempts < max, nextAttemptAt = now + backoff)
                       │
                       └──non-retryable error, or attempts = max──▶ FAILED
```

- **Claiming** is one atomic update: `UPDATE action SET status='PROCESSING', lockedAt=now WHERE id=? AND status='PENDING'`. If 0 rows change, someone else already has it. This stops the immediate run and the worker from both sending the same message.
- **Worker** runs every 5s. It picks due `PENDING` actions (`nextAttemptAt <= now`) plus `PROCESSING` actions whose `lockedAt` is older than 2 min (the server crashed mid-action). On boot it does the same, so nothing pending is lost across restarts.
- **Backoff:** 10s, 30s, 2m, 10m. Max 5 attempts.
- **Error classes:**
  - Retryable: network errors, timeouts, 5xx, 429 (wait `retry_after`).
  - Non-retryable: other 4xx (bad webhook URL, missing permission). These go straight to `FAILED` with the error visible in the dashboard.
- **REPLY and the 15-minute token:** if the token has expired, `REPLY` fails for good. That's acceptable because `CHANNEL_POST` already put the report in the channel. There's no fallback logic.
- Every outbound HTTP call has a 5s timeout.

## 4. Data model

All Discord IDs ("snowflakes") are stored as **strings**. They are 64-bit and overflow JS numbers.

### Guild — a Discord server

| Field | Type | Notes |
|---|---|---|
| `id` | string PK | Discord guild id |
| `name` | string? | For the dashboard |
| `postChannelId` | string? | Channel the bot posts report cards to |
| `mirrorWebhookUrl` | string? | **Secret.** Never returned to the client (API returns only `mirrorConfigured: true` or a masked value). Never logged. |
| `connectedAt` | datetime? | Set when connected through the dashboard; null = seen via a command but not set up |
| `createdAt`, `updatedAt` | datetime | |

Unknown guilds (the bot was added without going through the dashboard) get a row automatically on the first command. The command is still recorded and replied to; only `CHANNEL_POST`/`MIRROR` are skipped.

### CommandConfig — per guild, per command

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `guildId` | FK → Guild | |
| `commandName` | string | `report`, `status` |
| `enabled` | bool, default true | Disabled → ephemeral "this command is disabled" |
| `mirrorEnabled` | bool, default true | |
| `mirrorMinPriority` | enum `LOW \| MEDIUM \| HIGH`, default `LOW` | Mirror only when the rule's priority is ≥ this. E.g. `HIGH` → only urgent reports reach the mirror channel. |
| `postToChannel` | bool, default true | |
| | | **Unique (`guildId`, `commandName`)** |

Created with defaults when a guild row is created.

### Rule — configurable keyword → priority

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `guildId` | FK → Guild | |
| `commandName` | string | Rules apply per command (only `report` for now) |
| `keyword` | string | Case-insensitive "contains" match |
| `priority` | enum `LOW \| MEDIUM \| HIGH` | |
| `enabled` | bool | |
| `position` | int | Evaluated in order; first match wins |
| | | Index (`guildId`, `commandName`) |

No match → `LOW`. Kept deliberately simple: "contains keyword → set priority". No regex, no AND/OR.

### Interaction — every command received

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | Our id, shown as "Report #42" |
| `discordId` | string, **UNIQUE** | Discord's interaction id. **This constraint is the dedup.** |
| `guildId` | FK → Guild | |
| `type` | int | 2 / 3 / 5 |
| `commandName` | string | |
| `userId`, `userName` | string | Who ran it |
| `channelId` | string | Where it was run |
| `input` | text? | The report text |
| `priority` | enum? | Rule result |
| `matchedRuleId` | int? | Which rule fired (for the dashboard: "why HIGH?") |
| `token` | string? | **Sensitive** — lets anyone reply as the bot for 15 min. Needed for `REPLY` retries; set to null once `REPLY` finishes. Never logged or sent to the client. |
| `aiSummary`, `aiTags` | text?, string[]? | Stretch |
| `createdAt` | datetime | Index (`guildId`, `createdAt desc`) for the live log |

### Action — each side effect of an interaction

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `interactionId` | FK → Interaction | |
| `guildId` | string | Denormalized so per-guild queries don't need a join |
| `type` | enum `REPLY \| CHANNEL_POST \| MIRROR \| AI_TRIAGE` | |
| `status` | enum `PENDING \| PROCESSING \| SUCCEEDED \| FAILED` | |
| `attempts` | int, default 0 | |
| `maxAttempts` | int, default 5 | |
| `nextAttemptAt` | datetime | |
| `lockedAt` | datetime? | For crash recovery |
| `lastError` | text? | Sanitized. No URLs or tokens. |
| `completedAt` | datetime? | |
| `createdAt`, `updatedAt` | datetime | |
| | | **Unique (`interactionId`, `type`)**: an interaction can never get two MIRROR actions. Index (`status`, `nextAttemptAt`) for the worker. |

### ActionAttempt — history of every try (observability)

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `actionId` | FK → Action | |
| `attemptNo` | int | |
| `ok` | bool | |
| `httpStatus` | int? | |
| `error` | text? | Sanitized |
| `durationMs` | int | |
| `createdAt` | datetime | |

This is what makes "visible history of failures and retries" real rather than just a counter.

### Not in the DB

- **Admin account:** email + bcrypt hash in env vars. There's only one admin, so a users table isn't needed.
- **Sessions:** signed JWT in an httpOnly, secure, sameSite cookie. No sessions table.
- **Secrets:** bot token, public key, Groq key, DB URL, session secret all come from env.

## 5. Connecting a server (admin flow)

1. The admin logs in and clicks **Add to Discord server**.
2. The server redirects to Discord's OAuth2 URL with `scope=bot applications.commands`, the bot permissions (View Channel, Send Messages, Embed Links), `redirect_uri`, and a random `state` stored in the admin's session (CSRF protection).
3. The admin picks a server on Discord. Discord redirects back to `/api/discord/callback?guild_id=...&state=...`.
4. The server checks that `state` matches, then **confirms the bot is really in that guild** (`GET /guilds/{id}` with the bot token). We don't trust `guild_id` from the URL. Then it upserts the Guild with `connectedAt = now`.
5. The dashboard lists the guild's text channels (`GET /guilds/{id}/channels`). The admin picks the post channel and pastes the mirror webhook URL.

## 6. HTTP API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Uptime pinger. Does not touch the DB. |
| POST | `/api/interactions` | Discord signature | Discord interactions |
| POST | `/api/auth/login` | none (rate-limited) | Email + password → session cookie |
| POST | `/api/auth/logout` | session | |
| GET | `/api/auth/me` | session | |
| GET | `/api/discord/install` | session | Redirect to Discord OAuth2 |
| GET | `/api/discord/callback` | session + state | Finish connecting |
| GET | `/api/guilds` | session | Connected guilds |
| GET | `/api/guilds/:guildId/channels` | session | Channel picker |
| PATCH | `/api/guilds/:guildId` | session | Set post channel / mirror webhook |
| GET | `/api/guilds/:guildId/interactions?cursor=` | session | Live log (with actions), polled every 3s |
| GET | `/api/guilds/:guildId/commands` | session | Command configs |
| PATCH | `/api/guilds/:guildId/commands/:name` | session | Enable/disable, mirror on/off |
| GET, POST, PATCH, DELETE | `/api/guilds/:guildId/rules[/:id]` | session | Rule CRUD |
| POST | `/api/actions/:id/retry` | session | Manually retry a FAILED action |

Every `/api/guilds/:guildId/*` query filters by `guildId`. That's the multi-server isolation.

## 7. Security checklist (mapped to code)

| Threat | Where handled |
|---|---|
| Forged request | `middleware/verifyDiscordSignature.ts`: raw body, 401 |
| Replay | Same middleware: timestamp window; plus the `discordId` unique constraint |
| Junk body | 100kb body limit; zod schema after verification; 400, never 500 |
| Duplicate delivery | Unique `Interaction.discordId` + unique (`interactionId`, `type`) on Action + atomic claim |
| Secrets in logs | pino `redact` paths + never logging request headers or bodies raw |
| Secrets to client | API returns only masked mirror URL and never the token. Frontend has no env secrets (Vite only exposes `VITE_*`, and we define none that are secret). |
| Dashboard access | httpOnly cookie, auth middleware on all `/api/*` except health/interactions/login; login rate limit |
| Fake `guild_id` in OAuth callback | `state` check + verify bot membership via Discord API |

## 8. Folder structure

```text
server/
  src/
    index.ts                 # boot: env check, start HTTP, start worker
    app.ts                   # express app wiring
    config/env.ts            # zod-validated env
    routes/                  # URL → controller wiring only
    controllers/             # HTTP in/out
    middleware/              # verifyDiscordSignature, requireAuth, errorHandler
    services/
      interactions/          # handle command/component/modal, rule engine
      actions/               # executors per action type + worker
      discord/api.ts         # the ONE place that calls Discord REST
      mirror.ts
    utils/                   # logger, http (fetch with timeout), errors
    types/                   # shared types (Discord payloads, enums)
  prisma/schema.prisma
  scripts/registerCommands.ts
client/
  src/
    pages/                   # Login, Dashboard, GuildSettings
    components/
    api/                     # fetch wrapper
```

## 9. Resolved questions

1. **Mirror via a Discord channel webhook URL**, stored per guild and treated as a secret. It works independently of the bot, and the brief lists "mirror-channel URLs" as secrets, which implies webhooks.
2. **`/report` is always deferred.** One code path; the AI step fits in later without changing the flow.
3. **Unknown guilds are auto-registered** and their commands are recorded and replied to; `CHANNEL_POST`/`MIRROR` are skipped until the guild is connected in the dashboard.
4. **The rule must change behaviour**, not just label: `mirrorMinPriority` per command.
5. **Keep `ActionAttempt`.** It's cheap, and it is exactly the "visible history of failures and retries" stretch goal.
