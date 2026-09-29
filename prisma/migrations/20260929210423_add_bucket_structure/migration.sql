-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingAccountType" AS ENUM ('LIQUID_ASSETS', 'RECEIVABLES', 'PREPAYMENTS', 'OTHER_CURRENT_ASSETS', 'NON_CURRENT_ASSETS', 'LIABILITIES', 'EQUITY', 'INCOME', 'EXPENSES');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "Bucket" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "bookingAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAccountTemplate" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "BookingAccountType" NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPostable" BOOLEAN NOT NULL DEFAULT true,
    "allowsCustomChildren" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAccountTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAccount" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BookingAccountType" NOT NULL,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPostable" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "templateId" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bucket_number_key" ON "Bucket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Bucket_bookingAccountId_key" ON "Bucket"("bookingAccountId");

-- CreateIndex
CREATE INDEX "Bucket_ownerId_idx" ON "Bucket"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAccountTemplate_number_key" ON "BookingAccountTemplate"("number");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAccountTemplate_code_key" ON "BookingAccountTemplate"("code");

-- CreateIndex
CREATE INDEX "BookingAccountTemplate_parentId_idx" ON "BookingAccountTemplate"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAccount_number_key" ON "BookingAccount"("number");

-- CreateIndex
CREATE INDEX "BookingAccount_templateId_idx" ON "BookingAccount"("templateId");

-- CreateIndex
CREATE INDEX "BookingAccount_ownerId_type_idx" ON "BookingAccount"("ownerId", "type");

-- CreateIndex
CREATE INDEX "BookingAccount_parentId_idx" ON "BookingAccount"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAccount_ownerId_templateId_key" ON "BookingAccount"("ownerId", "templateId");

-- AddForeignKey
ALTER TABLE "Bucket" ADD CONSTRAINT "Bucket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bucket" ADD CONSTRAINT "Bucket_bookingAccountId_fkey" FOREIGN KEY ("bookingAccountId") REFERENCES "BookingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAccountTemplate" ADD CONSTRAINT "BookingAccountTemplate_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BookingAccountTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAccount" ADD CONSTRAINT "BookingAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAccount" ADD CONSTRAINT "BookingAccount_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BookingAccountTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAccount" ADD CONSTRAINT "BookingAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BookingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
