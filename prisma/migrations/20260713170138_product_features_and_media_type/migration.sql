-- CreateEnum
CREATE TYPE "ProductMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "features" JSONB;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "type" "ProductMediaType" NOT NULL DEFAULT 'IMAGE';
