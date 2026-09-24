# CLAUDE.md

Context for AI assistants working in this repo. Read this first, every session.

## What this is

A job-assignment project (2-day deadline): a webhook-based Discord slash-command bot + admin dashboard.
Flow: Discord POSTs an interaction to `/api/interactions` → verify Ed25519 signature → persist (dedup on interaction id) → apply configurable rule → reply in Discord → mirror to a second channel (Discord webhook) → visible in the admin dashboard.

Full requirements: `docs/PLAN.md`. Architecture, flow and data model: `docs/DESIGN.md` (follow it; if code needs to differ, update the design first). Decisions and their reasons: `docs/DECISIONS.md`. Progress log: `docs/DEVLOG.md`.

## About me (the developer)

- ~9 months MERN experience; **first Discord bot**. When a Discord-specific concept comes up (interaction types, deferred responses, interaction tokens, OAuth2 bot scopes, webhooks), explain it briefly in plain terms before or while using it.
- I make the architecture and service decisions. If you think a decision is wrong, say so and why — don't silently work around it.

## Stack

- Backend: Node.js + Express + TypeScript (strict)
- Frontend: React + Vite + TypeScript, built and served by Express (single deployment)
- DB: Neon Postgres + Prisma
- Mirror channel: Discord channel webhook
- AI (stretch): Groq free tier
- Hosting: Render free web service, kept warm by a free uptime pinger hitting `/health`
- Logging: pino, secrets redacted, `interactionId` on every log line for an interaction

## Non-negotiable rules (these are graded — never weaken them)

1. **Verify the Ed25519 signature on every request to `/api/interactions`**, using the **raw body**. Use `express.raw()` on that route only; never let `express.json()` run before verification. Invalid/missing signature → `401`.
2. **Reject stale timestamps** (`X-Signature-Timestamp` older than 5 minutes) → `401`.
3. **Answer PING (type 1) with PONG (type 1).**
4. **Dedup on interaction id** via a DB unique constraint (insert-or-skip). A duplicate delivery must not repeat any side effect.
5. **Persist before acting.** Every downstream action (reply follow-up, mirror, AI) is a row with status `pending | success | failed`, attempt count, last error. Failures are retried by a background job, never dropped silently.
6. **Respect the 3-second window.** Anything that may be slow (AI, external HTTP) → send a deferred response first, then follow up via the interaction webhook (token valid 15 min).
7. **Secrets never leak**: bot token, public key, webhook URLs, DB URL, API keys live in env vars only. Never in the repo, never sent to the client, never logged (pino redaction). Webhook URLs shown in the UI are masked.
8. Every table carries `guildId` (multi-server isolation from day one).

## Code conventions

- Keep it simple. No clever abstractions, no speculative generality, no extra dependencies without a reason.
- Small files with clear roles: `routes/` (wiring only) → `controllers/` (HTTP in/out) → `services/` (logic, external calls) → Prisma. Plus `utils/`, `config/`, `types/`, `middleware/`.
- DRY: one shared helper each for Discord API calls, interaction responses, message formatting, validation, error handling. Shared types live in `types/`.
- Validate env at startup (fail fast with a clear message listing missing vars — names only, never values).
- No `any`. Use `zod` for validating external input (request bodies, env).
- Comments explain *why*, not *what*.

## Working style

- Build in small chunks. After each chunk: run it, test it (curl / real Discord), then commit.
- Commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`. One logical change per commit.
- After each task, append a short entry to `docs/DEVLOG.md` (what was done, problems hit, fix). If you (the AI) suggested something wrong that we had to correct, add it under **AI wrong turns** with specifics — this feeds `AI_NOTES.md`.
- New decision → add an entry to `docs/DECISIONS.md` (context, choice, trade-off).
- Don't start stretch goals until the core flow works end-to-end on the live URL.
- Never commit `.env`. Keep `.env.example` in sync with every new env var (placeholder values only).
