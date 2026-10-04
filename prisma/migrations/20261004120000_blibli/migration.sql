ALTER TABLE "Store" ADD COLUMN "apiUsername" TEXT,
ADD COLUMN "apiSignatureKey" TEXT;

ALTER TABLE "OrderItem" ADD COLUMN "marketplaceItemId" TEXT;

CREATE INDEX "OrderItem_marketplaceItemId_idx" ON "OrderItem"("marketplaceItemId");
