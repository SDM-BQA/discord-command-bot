import { Prisma } from "../generated/prisma/client";

/** True when an insert hit a unique constraint, e.g. the same Discord interaction delivered twice. */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
