-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('REPLY', 'CHANNEL_POST', 'MIRROR', 'AI_TRIAGE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "postChannelId" TEXT,
    "mirrorWebhookUrl" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "postToChannel" BOOLEAN NOT NULL DEFAULT true,
    "mirrorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mirrorMinPriority" "Priority" NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" SERIAL NOT NULL,
    "discordId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "commandName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "input" TEXT,
    "priority" "Priority",
    "matchedRuleId" INTEGER,
    "token" TEXT,
    "aiSummary" TEXT,
    "aiTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" SERIAL NOT NULL,
    "interactionId" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionAttempt" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommandConfig_guildId_commandName_key" ON "CommandConfig"("guildId", "commandName");

-- CreateIndex
CREATE INDEX "Rule_guildId_commandName_position_idx" ON "Rule"("guildId", "commandName", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Interaction_discordId_key" ON "Interaction"("discordId");

-- CreateIndex
CREATE INDEX "Interaction_guildId_createdAt_idx" ON "Interaction"("guildId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Action_status_nextAttemptAt_idx" ON "Action"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Action_guildId_createdAt_idx" ON "Action"("guildId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Action_interactionId_type_key" ON "Action"("interactionId", "type");

-- CreateIndex
CREATE INDEX "ActionAttempt_actionId_idx" ON "ActionAttempt"("actionId");

-- AddForeignKey
ALTER TABLE "CommandConfig" ADD CONSTRAINT "CommandConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_matchedRuleId_fkey" FOREIGN KEY ("matchedRuleId") REFERENCES "Rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionAttempt" ADD CONSTRAINT "ActionAttempt_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
