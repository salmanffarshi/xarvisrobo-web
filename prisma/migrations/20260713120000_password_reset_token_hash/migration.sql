-- DropIndex
DROP INDEX "PasswordResetToken_token_key";

-- DropIndex
DROP INDEX "PasswordResetToken_email_idx";

-- AlterTable
ALTER TABLE "PasswordResetToken" DROP COLUMN "email",
DROP COLUMN "token",
DROP COLUMN "expires",
ADD COLUMN     "userId" TEXT NOT NULL,
ADD COLUMN     "tokenHash" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
