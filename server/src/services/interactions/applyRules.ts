import { Priority, type Rule } from "../../generated/prisma/client";

export type RuleResult = { priority: Priority; matchedRuleId: number | null };

/** First enabled rule (by position) whose keyword appears in the text wins; no match means LOW. */
export function applyRules(rules: Rule[], commandName: string, text: string): RuleResult {
  const haystack = text.toLowerCase();
  const match = rules
    .filter((rule) => rule.enabled && rule.commandName === commandName)
    .sort((a, b) => a.position - b.position)
    .find((rule) => haystack.includes(rule.keyword.toLowerCase()));

  return match
    ? { priority: match.priority, matchedRuleId: match.id }
    : { priority: Priority.LOW, matchedRuleId: null };
}
