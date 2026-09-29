-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('NATURAL_PERSON', 'LEGAL_ENTITY');

-- CreateEnum
CREATE TYPE "PartnerLinkStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "type" "PartnerType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "contactLink" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerUserLink" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "partnerId" TEXT NOT NULL,
    "linkedUserId" TEXT NOT NULL,
    "status" "PartnerLinkStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerUserLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_number_key" ON "Partner"("number");

-- CreateIndex
CREATE INDEX "Partner_ownerId_idx" ON "Partner"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerUserLink_number_key" ON "PartnerUserLink"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerUserLink_partnerId_key" ON "PartnerUserLink"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerUserLink_linkedUserId_status_idx" ON "PartnerUserLink"("linkedUserId", "status");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerUserLink" ADD CONSTRAINT "PartnerUserLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerUserLink" ADD CONSTRAINT "PartnerUserLink_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
