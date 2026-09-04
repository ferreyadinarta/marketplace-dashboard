-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "escrowAt" TIMESTAMP(3);

-- Order yang feenya sudah terisi pasti pernah ditarik escrow-nya; tandai supaya
-- sync berikutnya tidak menariknya ulang satu per satu.
UPDATE "Order" SET "escrowAt" = "createdAt" WHERE "marketplaceFee" > 0;
