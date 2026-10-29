-- Sở thích khách tự khai ở trang onboarding (tín hiệu tường minh cho AI-Rec).
-- Sinh bằng `prisma migrate diff` chứ không viết tay, để khớp tuyệt đối quy ước
-- của Prisma — viết tay lệch một chi tiết (ví dụ DEFAULT của mảng) là lần
-- `migrate dev` sau báo drift và đòi reset database.
--
-- ON DELETE CASCADE: xoá khách thì sở thích đi theo, không để lại dòng mồ côi.

-- CreateTable
CREATE TABLE "CustomerPreference" (
    "customer_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "liked_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "liked_brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disliked_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disliked_brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_band" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPreference_pkey" PRIMARY KEY ("customer_id")
);

-- AddForeignKey
ALTER TABLE "CustomerPreference" ADD CONSTRAINT "CustomerPreference_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "B2CCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

