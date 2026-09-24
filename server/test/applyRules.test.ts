import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Rule } from "../src/generated/prisma/client";
import { applyRules } from "../src/services/interactions/applyRules";

let nextId = 1;
function rule(keyword: string, priority: Rule["priority"], extra: Partial<Rule> = {}): Rule {
  const id = nextId++;
  return {
    id,
    guildId: "g",
    commandName: "report",
    keyword,
    priority,
    enabled: true,
    position: id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
}

describe("applyRules", () => {
  test("no rules → LOW with no matched rule", () => {
    assert.deepEqual(applyRules([], "report", "anything"), { priority: "LOW", matchedRuleId: null });
  });

  test("matches keywords case-insensitively", () => {
    const payment = rule("Payment", "HIGH");
    assert.deepEqual(applyRules([payment], "report", "the PAYMENT page is down"), {
      priority: "HIGH",
      matchedRuleId: payment.id,
    });
  });

  test("first rule by position wins, not array order", () => {
    const bug = rule("bug", "MEDIUM", { position: 2 });
    const payment = rule("payment", "HIGH", { position: 1 });
    assert.equal(applyRules([bug, payment], "report", "payment bug").matchedRuleId, payment.id);
  });

  test("ignores disabled rules and rules for other commands", () => {
    const disabled = rule("payment", "HIGH", { enabled: false });
    const otherCommand = rule("payment", "HIGH", { commandName: "status" });
    assert.equal(applyRules([disabled, otherCommand], "report", "payment").priority, "LOW");
  });
});
