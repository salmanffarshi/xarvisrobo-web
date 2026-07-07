-- CreateEnum
CREATE TYPE "DeliveryZone" AS ENUM ('INSIDE_DHAKA', 'OUTSIDE_DHAKA');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('WAITING_FOR_PAYMENT', 'WAITING_FOR_PAYMENT_VERIFICATION', 'PAYMENT_VERIFIED', 'WAITING_FOR_ORDER_CONFIRMATION', 'ORDER_CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "fromStatus" TYPE "OrderStatus_new" USING ("fromStatus"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "toStatus" TYPE "OrderStatus_new" USING ("toStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryZone" "DeliveryZone" NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;

