CREATE TABLE "QuoteSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "requesterScope" TEXT NOT NULL DEFAULT 'SELECTED',
  "allowCustomersNoPurchase" BOOLEAN NOT NULL DEFAULT true,
  "allowRepeatCustomers" BOOLEAN NOT NULL DEFAULT false,
  "allowAbandonedCheckout" BOOLEAN NOT NULL DEFAULT false,
  "allowEmailSubscribers" BOOLEAN NOT NULL DEFAULT false,
  "allowPurchasedCustomers" BOOLEAN NOT NULL DEFAULT false,
  "selectedCustomerQuery" TEXT,
  "emailPatterns" TEXT,
  "productEligibility" TEXT NOT NULL DEFAULT 'ALL',
  "quoteExpiresAfterDays" INTEGER NOT NULL DEFAULT 7,
  "reminderBeforeExpireDays" INTEGER NOT NULL DEFAULT 3,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "QuoteSetting_shop_key" ON "QuoteSetting"("shop");
