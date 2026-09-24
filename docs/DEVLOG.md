# Dev Log

Entry format: `### YYYY-MM-DD HH:MM — title` then Done / Problem / Fix (skip the parts that don't apply).

## Log

### 2026-09-24 — Project kickoff

- **Done:** Read the brief. Wrote `CLAUDE.md` (AI context + non-negotiable security rules), `docs/PLAN.md` (requirements + quality-bar checklist), `docs/DECISIONS.md` (proposed architecture).
- **Next:** Confirm proposed decisions → create accounts (Discord app, Neon, Render, Groq) → scaffold.

### 2026-09-24 — Stage 1: accounts setup

- **Done:** Created Discord application in the Developer Portal. Saved Application ID, Public Key, Bot Token to local `.env` (git-ignored, verified with `git check-ignore`). Privileged gateway intents left off (webhook-only bot doesn't need them); Public Bot left on so reviewers can add it. Created test server with `#bot-commands` and `#mirror-log`, enabled Developer Mode. Interactions Endpoint URL not set yet — needs the deployed URL.
- **Note:** Bot token handled only via `.env`, never pasted into the AI chat.
- **Next:** Neon project.

### 2026-09-24 — Paused setup to do design first

- **Problem:** We were creating accounts (Discord, Neon) and heading to deploy before designing the flow, data model or constraints.
- **Fix:** Stopped and wrote `docs/DESIGN.md` (flow, action lifecycle, schema with constraints, API, security mapping). Setup resumes after design review.

### 2026-09-24 — Design reviewed and agreed

- **Done:** Reviewed `docs/DESIGN.md` against the assignment PDF line by line. Found a gap: the rule only labelled reports (HIGH/LOW) and didn't change behaviour, so added `mirrorMinPriority` per command (D9). Chose webhook mirror (D8). Agreed the data model and its constraints (unique `discordId` for dedup, unique `(interactionId, type)` on actions, `guildId` everywhere).
- **Next:** Neon project → Prisma schema from §4.

### 2026-09-24 — Neon database created

- **Done:** Neon project `discord-command-bot` in Singapore. Pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) URLs in `.env`, both `sslmode=require`. Checked by variable name/shape only; the values never went into the AI chat.
- **Skipped:** Neon's "set up with AI agent" prompt (global CLI, MCP server, `neon.ts`, `neon deploy`). Not needed: Prisma only needs the URLs, hosting is Render, and I don't want the AI to have direct DB access.
- **Note:** AI suggested US East; I picked Singapore. Fine as long as Render is in the same region.

### 2026-09-24 — Server skeleton

- **Done:** npm workspaces (root + `server/`). Express 5 + TypeScript 7 (strict, `noUncheckedIndexedAccess`). `config/env.ts` validates env with zod at startup; `utils/logger.ts` is pino with redaction of token/password/cookie/webhook fields; `GET /health` (no DB access). No `dotenv`: Node 22's `--env-file` loads `.env` in dev.
- **Tested:** `/health` → 200 in dev and in the compiled production build (JSON logs). Starting with no env vars exits 1 and lists only variable names, no values.
- **Problem:** First prod test failed: `DATABASE_URL` missing. Cause: I loaded `.env` with bash `source`, and the `&` in the Neon URL query string broke it. **Fix:** use `node --env-file`. The app itself was fine.
- **Note:** npm installed `@types/node@26` while runtime is Node 22; pinned to `@types/node@22` so types match what exists at runtime.

### 2026-09-24 — Branching: stage → main

- **Done:** Created `stage` branch. From now on all commits go to `stage`; `main` only receives tested work via PR and is what Render deploys. Rule added to `CLAUDE.md`.
- **Why not rewrite history:** the first 10 commits (docs + skeleton) were already pushed to `main`. Force-pushing to move them isn't worth it; they're a reasonable baseline.

### 2026-09-24 — First deploy to Render

- **Done:** PR #1 (`stage → main`) merged. Render free web service in Singapore, deploying `main`. Build: `npm ci --include=dev && npm run build` (`--include=dev` because `NODE_ENV=production` would otherwise skip TypeScript). Start: `npm start`. Health check path `/health`. Node pinned with `.node-version` = 22.
- **Tested:** `https://discord-command-bot-mxhq.onrender.com/health` → 200 in ~0.4s; unknown route → 404; no `X-Powered-By` header.
- **Workflow change:** from here I commit myself; the AI only edits files and suggests commit messages.
- **Next:** uptime pinger so Render doesn't sleep.

### 2026-09-24 — Interactions endpoint: signature + PING

- **Done:** `POST /api/interactions` with `express.raw` (100kb limit, any Content-Type kept as a Buffer) → `verifyDiscordSignature` middleware (headers present, timestamp within ±5 min, Ed25519 via `discord-interactions`' `verifyKey`) → controller parses JSON + zod → PING returns PONG. JSON 404 and error handler (never leaks internals). `trust proxy` so logs show the real client IP on Render.
- **Decision:** Used only `verifyKey` from `discord-interactions`, not its `verifyKeyMiddleware`: the middleware doesn't check timestamp age (replays) and parses the body itself. Checked `verifyKey` source: it catches all errors and returns false, so a malformed signature can't crash us.
- **Tested:** 10 `node:test` tests with our own Ed25519 key pair acting as Discord: valid PING, no headers, wrong key, tampered body, garbage signature, stale timestamp, non-numeric timestamp, non-JSON, wrong JSON shape, oversized body. **Mutation check:** disabling the signature check made 3 tests fail, so the tests really guard it.
- **Next:** deploy, then set Interactions Endpoint URL in the Developer Portal (Discord sends a PING and a bad-signature request to validate it).

### 2026-09-24 — Live attack test of /api/interactions

- **Done:** PR #2 merged; Render redeployed in ~30s. Attacked the live URL: no headers, random 64-byte signature, garbage signature, 1-hour-old timestamp, empty body, form-encoded junk → all 401; 300kb body → 413; GET → 404. No stack traces or `X-Powered-By` in responses.
- **Pending:** valid-signature PING can only come from Discord → verified when saving the Interactions Endpoint URL in the portal.

### 2026-09-24 — Discord accepted the Interactions Endpoint URL

- **Done:** Saved `https://discord-command-bot-mxhq.onrender.com/api/interactions` in the Developer Portal. Discord validates it by sending a signed PING (must PONG) and a badly signed request (must 401); it saved first time. Valid-signature path now proven live.

### 2026-09-25 — Slash commands registered, bot invited

- **Done:** `npm run register-commands` PUTs `/report` (required `text`, max 1000) and `/status` as **global** commands (multi-server), guild-only context. Invited the bot with only View Channel + Send Messages + Embed Links. `/status` in Discord → our live endpoint → fallback "can't handle that yet": full path Discord → signature check → handler works.
- **Added:** `services/discord/api.ts`, the single Discord REST helper (bot auth, 5s timeout, `DiscordApiError` with status + retry-after).
- **Concept learned:** the bot shows "offline" because an HTTP-interactions bot never connects to the gateway; that's expected.

### 2026-09-25 — Prisma schema and first migration

- **Done:** `prisma/schema.prisma` from DESIGN §4 (Guild, CommandConfig, Rule, Interaction, Action, ActionAttempt + enums). Migration `init` applied to Neon. `src/db/prisma.ts` = PrismaClient + `@prisma/adapter-pg` on the pooled URL; `prisma.config.ts` points migrations at `DIRECT_URL`. Generated client is git-ignored and built by `postinstall`.
- **Prisma 7 differences (new to me):** URL lives in `prisma.config.ts`, not the schema; Prisma no longer loads `.env` (used Node's `process.loadEnvFile`, no dotenv); a driver adapter is required; client is generated into our `src/`. Checked by running `prisma init` in a scratch folder instead of trusting memory — it also tries to install AI skills/editor folders, so kept it out of the repo.
- **Tested:** migration SQL has the 3 unique indexes (`discordId`, `(interactionId,type)`, `(guildId,commandName)`) and 6 FKs. Against Neon: inserting the same `discordId` twice → Postgres rejects with `P2002`; deleting a guild cascades to its interactions.
- **npm audit:** 4 high in `mysql2` / `deepmerge-ts`, both inside the Prisma **CLI** (dev tool), not in our runtime; we don't use MySQL. `audit fix --force` would downgrade to Prisma 6, so accepted.
- **Warning fixed:** pg warned that `sslmode=require` will weaken to libpq semantics in its next major → switched both URLs to `sslmode=verify-full` (same strict behaviour as today, explicit).

### 2026-09-25 — Record every command, with dedup and rules

- **Done:** `handleCommand`: guild check → `getOrCreateGuild` (one query; unseen guilds get default configs + 5 default rules so they work before the dashboard exists) → `applyRules` (pure function: first enabled rule by position whose keyword is in the text; else LOW) → `recordInteraction` (insert; unique `discordId` violation = duplicate → do nothing) → reply. Both commands reply immediately for now; `/report` moves to deferred + actions in step 8. DB errors → honest ephemeral "not recorded, try again" instead of a timeout. Logs `durationMs` per command.
- **Tested:** 4 unit tests for `applyRules`. Local server + real Neon, signed with a test key: payment→HIGH, bug→MEDIUM, no keyword→LOW; same interaction twice → "already processed"; **3 simultaneous copies → exactly 1 row**; DM → refused; `/status` correct. No interaction token in logs. Test guild deleted afterwards.
- **Finding:** first command took **2.3s** (Neon wake + new connection + guild creation, over India→Singapore). Too close to Discord's 3s. Must measure on Render (same region as Neon) and decide in step 8.
- **Note:** report ids have gaps (#3, #5…) because a failed duplicate insert still consumes a Postgres sequence value. Harmless.
- **AI tooling slip:** the AI's first attempt to write these files failed on a shell quoting error, so nothing was written. It checked `git status`, saw no changes, and rewrote them with its file tool.

### 2026-09-25 — Response budget for the 3-second window (D10)

- **Measured on Render:** first command after deploy 2016ms, next 128ms.
- **Done:** `respondWithinBudget` races handling against `RESPONSE_BUDGET_MS` (1500): fast → direct reply; slow → type 5 "thinking…", then `PATCH /webhooks/{app}/{token}/messages/@original` with the result or an explicit error. `editOriginalResponse` in `services/discord/interactionWebhook.ts`.
- **Security catch:** the follow-up URL contains the interaction token and `DiscordApiError` includes the path → a failed follow-up would have logged the token. Added `redactPath` → `/webhooks/{app}/[token]/…`, with tests.
- **Bug caught while reading:** with no `retry-after` header, `Number(null)` is `0`, so we reported "retry after 0ms" instead of "no hint". Fixed.
- **Tested:** 20 tests pass, incl. fast reply, slow → deferred + edit, slow failure → deferred + explicit error, fast failure → caller's error reply.

## AI wrong turns

Record every time the AI suggested something wrong: what it said, how I noticed, what the fix was.

### 1. Jumped to account setup before any design (2026-09-24)

- **What the AI did:** After writing the plan, it went straight to "Stage 1: create accounts", then Neon setup, with the next step being deploy. There was no design of the interaction flow, DB fields, constraints or API.
- **How I noticed:** Halfway through Neon setup I realised we didn't know which tables/fields we needed, or how dedup and retries would actually work — the things the quality bar grades.
- **Fix:** Paused and made the AI produce `docs/DESIGN.md` for review section by section before any more setup or code.
- **Lesson:** The AI followed my Day 1 schedule literally (it started with "accounts setup"). Design has to be an explicit step in the plan.

### 2. Committed straight to `main` (2026-09-24)

- **What the AI did:** Made every commit (docs and the server skeleton) directly on `main`, with no branch.
- **How I noticed:** Before deploying, I realised `main` would be what Render deploys, and untested work was going straight onto it.
- **Fix:** Created a `stage` branch; the rule "never commit to `main`, PR `stage → main` after testing" is now in `CLAUDE.md` so the AI checks the branch before committing.
