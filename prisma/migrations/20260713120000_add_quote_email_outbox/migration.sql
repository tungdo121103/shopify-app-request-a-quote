ALTER TABLE "Quote" ADD COLUMN "offerVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "QuoteEmailDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "processingAt" DATETIME,
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteEmailDelivery_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QuoteEmailDelivery_idempotencyKey_key"
  ON "QuoteEmailDelivery"("idempotencyKey");
CREATE INDEX "QuoteEmailDelivery_status_nextAttemptAt_idx"
  ON "QuoteEmailDelivery"("status", "nextAttemptAt");
CREATE INDEX "QuoteEmailDelivery_shop_quoteId_idx"
  ON "QuoteEmailDelivery"("shop", "quoteId");
