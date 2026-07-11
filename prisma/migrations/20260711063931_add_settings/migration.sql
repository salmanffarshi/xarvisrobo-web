-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "bkashNumber" TEXT NOT NULL,
    "bkashType" TEXT NOT NULL,
    "bkashInstructions" TEXT,
    "nagadNumber" TEXT NOT NULL,
    "nagadType" TEXT NOT NULL,
    "nagadInstructions" TEXT,
    "whatsappNumber" TEXT NOT NULL,
    "codInsideDhaka" INTEGER NOT NULL,
    "codOutsideDhaka" INTEGER NOT NULL,
    "paymentGeneralNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
