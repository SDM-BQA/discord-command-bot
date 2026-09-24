import type { Response } from "express";
import type { Logger } from "pino";
import { env } from "../../config/env";
import { editOriginalResponse } from "../discord/interactionWebhook";
import {
  COMMAND_FAILED_TEXT,
  deferredResponse,
  type MessageData,
  type MessageResponse,
} from "../../utils/discordResponses";

// Discord gives up after 3s. Normal handling takes ~130ms, but a cold DB connection has taken ~2s,
// so by default (RESPONSE_BUDGET_MS=1500) we stop waiting well before the limit.

type Options = {
  token: string;
  log: Logger;
  budgetMs?: number;
  // Injectable so tests can observe the follow-up without calling Discord.
  editOriginal?: (token: string, data: MessageData) => Promise<unknown>;
};

/**
 * Replies directly if `work` finishes within the budget. Otherwise answers "thinking…" immediately and edits
 * in the real reply when `work` finishes, or an explicit error if it fails. Either way the user always gets
 * an answer: we never time out and never go silent.
 *
 * If `work` fails *within* the budget, this rejects and the caller replies with an error directly.
 */
export async function respondWithinBudget(res: Response, work: Promise<MessageResponse>, options: Options) {
  const { token, log, budgetMs = env.RESPONSE_BUDGET_MS, editOriginal = editOriginalResponse } = options;

  const overBudget = Symbol("overBudget");
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<typeof overBudget>((resolve) => {
    timer = setTimeout(() => resolve(overBudget), budgetMs);
  });

  const first = await Promise.race([work, deadline]).finally(() => clearTimeout(timer));
  if (first !== overBudget) {
    res.json(first);
    return;
  }

  log.warn({ budgetMs }, "response budget exceeded, deferring");
  // All command replies are currently ephemeral, so the placeholder must be too.
  res.json(deferredResponse(true));

  let followUp: MessageData;
  try {
    followUp = (await work).data;
  } catch (err) {
    log.error({ err }, "command failed after deferring");
    followUp = { content: COMMAND_FAILED_TEXT };
  }

  try {
    await editOriginal(token, followUp);
    log.info("deferred reply delivered");
  } catch (err) {
    // Discord itself is unreachable; the user is left with "thinking…" until Discord marks it failed.
    log.error({ err }, "could not deliver deferred reply");
  }
}
