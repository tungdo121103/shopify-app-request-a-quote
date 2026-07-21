CREATE TABLE IF NOT EXISTS "QuoteEmailBranding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "senderName" TEXT NOT NULL DEFAULT '',
  "logoUrl" TEXT NOT NULL DEFAULT '',
  "primaryColor" TEXT NOT NULL DEFAULT '#152f7c',
  "linkColor" TEXT NOT NULL DEFAULT '#1769aa',
  "signature" TEXT NOT NULL DEFAULT 'Customer service team',
  "replyToEmail" TEXT NOT NULL DEFAULT '',
  "footerText" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteEmailBranding_shop_key" ON "QuoteEmailBranding"("shop");
