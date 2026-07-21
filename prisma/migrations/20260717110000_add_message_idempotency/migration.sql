ALTER TABLE "ConversationMessage" ADD COLUMN "clientMessageId" TEXT;
ALTER TABLE "ConversationMessage" ADD COLUMN "sourceIpHash" TEXT;

CREATE UNIQUE INDEX "ConversationMessage_quoteId_clientMessageId_key"
ON "ConversationMessage"("quoteId", "clientMessageId");

CREATE INDEX "ConversationMessage_sourceIpHash_createdAt_idx"
ON "ConversationMessage"("sourceIpHash", "createdAt");
