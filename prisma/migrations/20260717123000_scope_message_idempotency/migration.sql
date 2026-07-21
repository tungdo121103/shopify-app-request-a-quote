DROP INDEX "ConversationMessage_quoteId_clientMessageId_key";

ALTER TABLE "ConversationMessage" ADD COLUMN "sourceActorHash" TEXT;

CREATE UNIQUE INDEX "ConversationMessage_quoteId_sender_clientMessageId_key"
ON "ConversationMessage"("quoteId", "sender", "clientMessageId");

CREATE INDEX "ConversationMessage_sourceActorHash_createdAt_idx"
ON "ConversationMessage"("sourceActorHash", "createdAt");
