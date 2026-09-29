-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'FILE_IMPORT', 'API_IMPORT');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "bucketId" TEXT NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "importData" JSONB,
    "valueDate" TIMESTAMP(3),
    "description" TEXT,
    "counterpartyName" TEXT,
    "counterpartyId" TEXT,
    "reference" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_number_key" ON "Transaction"("number");

-- CreateIndex
CREATE INDEX "Transaction_bucketId_occurredAt_idx" ON "Transaction"("bucketId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_bucketId_externalId_key" ON "Transaction"("bucketId", "externalId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "Bucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
