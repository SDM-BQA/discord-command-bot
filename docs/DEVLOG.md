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

## AI wrong turns

Record every time the AI suggested something wrong: what it said, how I noticed, what the fix was.

### 1. Jumped to account setup before any design (2026-09-24)

- **What the AI did:** After writing the plan, it went straight to "Stage 1: create accounts", then Neon setup, with the next step being deploy. There was no design of the interaction flow, DB fields, constraints or API.
- **How I noticed:** Halfway through Neon setup I realised we didn't know which tables/fields we needed, or how dedup and retries would actually work — the things the quality bar grades.
- **Fix:** Paused and made the AI produce `docs/DESIGN.md` for review section by section before any more setup or code.
- **Lesson:** The AI followed my Day 1 schedule literally (it started with "accounts setup"). Design has to be an explicit step in the plan.
