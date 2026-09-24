import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["silent", "fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DISCORD_APPLICATION_ID: z.string().regex(/^\d+$/, "must be a numeric Discord id"),
  DISCORD_PUBLIC_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "must be 64 hex characters"),
  DISCORD_BOT_TOKEN: z.string().min(1),

  DATABASE_URL: z.string().startsWith("postgres"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Report variable names and the rule they broke — never the values, which may be secrets.
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    console.error(`Invalid environment configuration:\n${problems.join("\n")}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
