import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Response } from "express";
import pino from "pino";

process.env.LOG_LEVEL = "silent";
process.env.DISCORD_APPLICATION_ID ??= "123456789012345678";
process.env.DISCORD_PUBLIC_KEY ??= "a".repeat(64);
process.env.DISCORD_BOT_TOKEN ??= "test-token";
process.env.DATABASE_URL ??= "postgresql://test";

const log = pino({ level: "silent" });
const BUDGET_MS = 50;

const reply = (content: string) => ({ type: 4, data: { content, flags: 64 } });
const after = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const failAfter = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("db down")), ms));

function fakeRes() {
  const sent: unknown[] = [];
  return { sent, res: { json: (body: unknown) => sent.push(body) } as unknown as Response };
}

function fakeEdit() {
  const edits: { token: string; content: string }[] = [];
  return { edits, editOriginal: async (token: string, data: { content: string }) => void edits.push({ token, content: data.content }) };
}

describe("respondWithinBudget", async () => {
  const { respondWithinBudget } = await import("../src/services/interactions/respondWithinBudget");
  const { COMMAND_FAILED_TEXT } = await import("../src/utils/discordResponses");

  test("fast work: replies directly, no follow-up", async () => {
    const { sent, res } = fakeRes();
    const { edits, editOriginal } = fakeEdit();
    await respondWithinBudget(res, after(5, reply("done")), { token: "t", log, budgetMs: BUDGET_MS, editOriginal });
    assert.deepEqual(sent, [reply("done")]);
    assert.equal(edits.length, 0);
  });

  test("slow work: answers 'thinking…' first, then edits in the real reply", async () => {
    const { sent, res } = fakeRes();
    const { edits, editOriginal } = fakeEdit();
    await respondWithinBudget(res, after(BUDGET_MS * 3, reply("late")), { token: "t", log, budgetMs: BUDGET_MS, editOriginal });
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], { type: 5, data: { flags: 64 } });
    assert.deepEqual(edits, [{ token: "t", content: "late" }]);
  });

  test("slow work that fails: the user still gets an explicit error, never silence", async () => {
    const { sent, res } = fakeRes();
    const { edits, editOriginal } = fakeEdit();
    await respondWithinBudget(res, failAfter(BUDGET_MS * 3), { token: "t", log, budgetMs: BUDGET_MS, editOriginal });
    assert.deepEqual(sent, [{ type: 5, data: { flags: 64 } }]);
    assert.deepEqual(edits, [{ token: "t", content: COMMAND_FAILED_TEXT }]);
  });

  test("fast failure: rejects so the caller can reply with the error directly", async () => {
    const { sent, res } = fakeRes();
    const { edits, editOriginal } = fakeEdit();
    await assert.rejects(respondWithinBudget(res, failAfter(5), { token: "t", log, budgetMs: BUDGET_MS, editOriginal }));
    assert.equal(sent.length, 0);
    assert.equal(edits.length, 0);
  });
});

describe("redactPath", async () => {
  const { redactPath } = await import("../src/services/discord/api");

  test("hides the interaction token in webhook paths", () => {
    assert.equal(redactPath("/webhooks/123/SECRET-TOKEN/messages/@original"), "/webhooks/123/[token]/messages/@original");
  });

  test("leaves other paths unchanged", () => {
    assert.equal(redactPath("/applications/123/commands"), "/applications/123/commands");
  });
});
