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

## AI wrong turns

Record every time the AI suggested something wrong: what it said, how I noticed, what the fix was.

None yet.
