-- AlterTable
ALTER TABLE "BookingAccount" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BookingAccountTemplate" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Bucket" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;
