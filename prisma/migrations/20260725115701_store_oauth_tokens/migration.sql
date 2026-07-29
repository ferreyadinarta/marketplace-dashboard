-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "shopCipher" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
