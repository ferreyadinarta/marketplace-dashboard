-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "hppSnapshot" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockRestock" ADD COLUMN     "cost" INTEGER NOT NULL DEFAULT 0;
