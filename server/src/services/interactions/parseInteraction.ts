import { interactionSchema, type Interaction } from "../../types/discord";

// Returns null for anything that isn't a well-formed interaction, so junk never reaches the handlers.
export function parseInteraction(rawBody: Buffer): Interaction | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return null;
  }
  const result = interactionSchema.safeParse(json);
  return result.success ? result.data : null;
}
