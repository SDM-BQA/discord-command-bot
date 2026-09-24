import { z } from "zod";

// Only the fields we read are validated; Discord sends many more, which zod strips.

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullish(),
});

const commandOptionSchema = z.object({
  name: z.string(),
  type: z.number().int(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const interactionSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  type: z.number().int(),
  token: z.string().optional(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  // In a server the user is inside `member`; in DMs it is top-level `user`.
  member: z.object({ user: userSchema }).optional(),
  user: userSchema.optional(),
  data: z
    .object({
      name: z.string().optional(),
      options: z.array(commandOptionSchema).optional(),
    })
    .optional(),
});

export type Interaction = z.infer<typeof interactionSchema>;

export function getStringOption(interaction: Interaction, name: string): string | undefined {
  const value = interaction.data?.options?.find((option) => option.name === name)?.value;
  return typeof value === "string" ? value : undefined;
}

export function getInvokingUser(interaction: Interaction) {
  const user = interaction.member?.user ?? interaction.user;
  return user ? { id: user.id, name: user.global_name ?? user.username } : undefined;
}
