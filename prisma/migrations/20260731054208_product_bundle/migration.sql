-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isBundle" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductComponent_bundleId_componentId_key" ON "ProductComponent"("bundleId", "componentId");

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
