-- CreateTable
CREATE TABLE "ShopCounter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopCounter_shop_key_key" ON "ShopCounter"("shop", "key");

-- CreateIndex
CREATE INDEX "ShopCounter_shop_idx" ON "ShopCounter"("shop");
