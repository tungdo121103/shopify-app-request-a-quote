DROP INDEX "Quote_quoteNumber_key";

CREATE UNIQUE INDEX "Quote_shop_quoteNumber_key"
ON "Quote"("shop", "quoteNumber");
