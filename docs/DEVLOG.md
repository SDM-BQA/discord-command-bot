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
