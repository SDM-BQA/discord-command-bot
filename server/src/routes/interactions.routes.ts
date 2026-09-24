import express, { Router } from "express";
import { verifyDiscordSignature } from "../middleware/verifyDiscordSignature";
import { handleInteraction } from "../controllers/interactions.controller";

export const interactionsRouter = Router();

// express.raw (not express.json): signature verification needs the untouched bytes.
// `type: () => true` keeps the body as a Buffer whatever Content-Type a junk request claims.
interactionsRouter.post(
  "/",
  express.raw({ type: () => true, limit: "100kb" }),
  verifyDiscordSignature,
  handleInteraction,
);
