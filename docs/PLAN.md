# Plan

Deadline: 2 days (started 2026-09-24).

## Core requirements

- [ ] Admin sign-in; connect a Discord server (add bot + pick a channel)
- [ ] Discord app with ≥2 registered slash commands (`/report <text>`, `/status`)
- [ ] Interactions endpoint that verifies, handles and records commands
- [ ] Bot responds in Discord for at least one command
- [ ] Mirror notification to a second channel (Discord channel webhook)
- [ ] Dashboard behind login: live log of commands + actions, command configuration
- [ ] Deployed on a public URL
- [ ] `README.md` (what it does, local setup, env vars, deployment) + `.env.example`
- [ ] Testing instructions: bot invite / test server, throwaway admin login
- [ ] `AI_NOTES.md` + AI context files as used

## Quality bar

| Requirement | Solution | Tested? |
|---|---|---|
| Forged / unsigned requests | Ed25519 verify on raw body, every request → 401 | unit ✅ / live ✅ |
| Replayed requests | Reject timestamp > 5 min old; dedup catches the rest | unit ✅ (timestamp) / live [ ] |
| Junk bodies | Verify before parsing; zod-validate after; 100kb limit (413); never 500 on bad input | unit ✅ / live ✅ |
| PING | Respond `{ type: 1 }` | unit ✅ / live ✅ (Discord accepted endpoint URL) |
| Duplicate delivery | Unique constraint on interaction id; insert-or-skip, no repeated side effects | local ✅ (incl. 3 simultaneous copies → 1 row) / live [ ] |
| Downstream briefly down | Persist first; actions table (status, attempts, lastError, nextAttemptAt); background retry with backoff | [ ] |
| Own service briefly down | Render kept warm by pinger; interactions persisted before ACK; pending actions resumed on boot | [ ] |
| ~3s window | Defer (type 5) for slow work, follow up via interaction webhook | [ ] |
| Secrets | Env only; pino redaction; masked in UI; never in client bundle | [ ] |

## Stretch goals (priority order)

1. [ ] Configurable command rules in the UI
2. [ ] Buttons on messages → follow-up action (type 3)
3. [ ] `/report` opens a modal (type 5)
4. [ ] AI triage via Groq, shown in reply + dashboard
5. [ ] Observability: structured logs + failures/retries view
6. [ ] Multi-server isolation (schema supports it from day 1)

## Setup progress

- [x] Discord application created (App ID, Public Key, Bot Token in `.env`)
- [x] Test server created (`#bot-commands`, `#mirror-log`), Developer Mode on
- [x] Neon project (`DATABASE_URL`, `DIRECT_URL`), region Singapore `ap-southeast-1`
- [x] Render web service (Singapore, deploys `main`): https://discord-command-bot-mxhq.onrender.com
- [ ] Mirror webhook on `#mirror-log`
- [ ] Groq API key (stretch)
- [x] Interactions Endpoint URL saved in Developer Portal (Discord verified PING + rejected-bad-signature probe)
- [x] Uptime pinger on `/health` (UptimeRobot, every 5 min)

## Schedule

**Day 1** — design review (`docs/DESIGN.md`) → accounts → skeleton → deploy hello world → interactions endpoint (signature + PING) → register commands → save + dedup → reply → mirror. Core flow live by end of day.

**Day 2** — admin login + server connection → dashboard (live log, rule config) → deferred responses + retry job → stretch goals → README, AI_NOTES, test instructions → deliberately test every quality-bar row.
