-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "refund_note" TEXT,
ADD COLUMN     "refund_ref" TEXT,
ADD COLUMN     "refunded_amount" INTEGER,
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "refunded_by" INTEGER;
