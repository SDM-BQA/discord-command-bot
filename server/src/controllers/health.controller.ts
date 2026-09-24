import type { Request, Response } from "express";

// Deliberately does not touch the database: the uptime pinger calls this every few minutes
// and should keep the server awake without keeping Neon's compute awake too.
export function getHealth(_req: Request, res: Response): void {
  res.json({ ok: true });
}
