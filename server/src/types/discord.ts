import { z } from "zod";

// Only the fields we read are validated; Discord sends many more, which zod strips.
export const interactionSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  type: z.number().int(),
  token: z.string().optional(),
});

export type Interaction = z.infer<typeof interactionSchema>;
