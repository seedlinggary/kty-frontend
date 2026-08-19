-- CreateEnum
CREATE TYPE "SignupStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionHe" TEXT,
    "memberPriceAgorot" INTEGER NOT NULL,
    "nonMemberPriceAgorot" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signup" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isMember" BOOLEAN NOT NULL,
    "menSeats" INTEGER NOT NULL DEFAULT 0,
    "womenSeats" INTEGER NOT NULL DEFAULT 0,
    "totalAgorot" INTEGER NOT NULL,
    "status" "SignupStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "signupId" TEXT NOT NULL,
    "nedarimTransactionId" TEXT,
    "confirmation" TEXT,
    "amountAgorot" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'webhook',
    "rawPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "aboutEn" TEXT NOT NULL,
    "aboutHe" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "serviceTimesEn" TEXT,
    "serviceTimesHe" TEXT,
    "heroTaglineEn" TEXT NOT NULL,
    "heroTaglineHe" TEXT NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_slug_key" ON "Holiday"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Signup_billId_key" ON "Signup"("billId");

-- CreateIndex
CREATE INDEX "Signup_holidayId_idx" ON "Signup"("holidayId");

-- CreateIndex
CREATE INDEX "Signup_status_idx" ON "Signup"("status");

-- CreateIndex
CREATE INDEX "Transaction_signupId_idx" ON "Transaction"("signupId");

-- AddForeignKey
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "Signup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
