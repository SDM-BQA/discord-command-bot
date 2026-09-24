import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../config/env";

// The app uses Neon's pooled URL; migrations use DIRECT_URL (see prisma.config.ts).
export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.DATABASE_URL,
    // pg waits forever for a connection by default; an unreachable DB must fail fast instead of hanging requests.
    connectionTimeoutMillis: 5000,
  }),
});
