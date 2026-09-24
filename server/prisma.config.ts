import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env itself. Locally we load the repo-root .env; on Render the variables are already set.
if (existsSync("../.env")) process.loadEnvFile("../.env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // The CLI (migrations) uses the direct, non-pooled connection; the app connects via DATABASE_URL in src/db/prisma.ts.
  datasource: { url: process.env.DIRECT_URL },
});
