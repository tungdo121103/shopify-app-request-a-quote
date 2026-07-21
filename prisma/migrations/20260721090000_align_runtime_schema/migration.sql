ALTER TABLE "QuoteSetting" ADD COLUMN "widgetStyle" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetButtonText" TEXT NOT NULL DEFAULT 'Get Quote';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetSize" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetOrientation" TEXT NOT NULL DEFAULT 'horizontal';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetDesktopPosition" TEXT NOT NULL DEFAULT 'middle_left';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetMobilePosition" TEXT NOT NULL DEFAULT 'bottom_right';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetDisplayMode" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetSpecificPages" TEXT;
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetBackgroundColor" TEXT NOT NULL DEFAULT '#120670';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetTextColor" TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetAnimation" TEXT NOT NULL DEFAULT 'pulse';
ALTER TABLE "QuoteSetting" ADD COLUMN "widgetIconDataUrl" TEXT;

CREATE TABLE "QuotePdfSetting" (
  "shop" TEXT NOT NULL PRIMARY KEY,
  "settingsJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "QuoteReadState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "viewer" TEXT NOT NULL,
  "viewerId" TEXT NOT NULL DEFAULT '',
  "lastReadAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "QuoteReadState_quoteId_viewer_viewerId_key"
  ON "QuoteReadState"("quoteId", "viewer", "viewerId");
CREATE INDEX "QuoteReadState_shop_viewer_idx"
  ON "QuoteReadState"("shop", "viewer");
CREATE INDEX "QuoteReadState_shop_quoteId_idx"
  ON "QuoteReadState"("shop", "quoteId");

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "customerId" TEXT,
  "customerEmail" TEXT,
  "payloadJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PrivacyRequest_shop_createdAt_idx"
  ON "PrivacyRequest"("shop", "createdAt");
