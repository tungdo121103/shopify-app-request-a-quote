ALTER TABLE "QuoteItem" ADD COLUMN "lastOfferedQuantity" INTEGER;
ALTER TABLE "QuoteItem" ADD COLUMN "lastOfferedQuotePrice" DECIMAL;

UPDATE "QuoteItem"
SET "lastOfferedQuantity" = "quantity",
    "lastOfferedQuotePrice" = "quotePrice";

ALTER TABLE "ConversationMessage" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "ConversationMessage" ADD COLUMN "eventType" TEXT;
