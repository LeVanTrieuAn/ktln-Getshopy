-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2CCustomer" (
    "id" BIGSERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "avatar" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2CCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "original_price" INTEGER NOT NULL,
    "category_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "variants" JSONB NOT NULL DEFAULT '[]',
    "branch_ids" JSONB NOT NULL DEFAULT '[]',
    "is_banner" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reply" TEXT,
    "reply_date" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashSale" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "product_id" TEXT,
    "category_id" TEXT,
    "discount_percent" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FlashSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashSaleItem" (
    "id" BIGSERIAL NOT NULL,
    "flash_sale_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "discount_price" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 100,
    "sold" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FlashSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customer" JSONB NOT NULL,
    "customer_id" BIGINT,
    "total" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "subTotal" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL DEFAULT 'COD',
    "payment_status" TEXT NOT NULL DEFAULT 'UNPAID',
    "payment_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_amount" INTEGER,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" BIGSERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "product_name" TEXT NOT NULL,
    "category_id" TEXT,
    "brand_id" TEXT,
    "branch_id" TEXT,
    "variant_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "net_amount" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" BIGSERIAL NOT NULL,
    "order_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_txn_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bank_account" TEXT,
    "content" TEXT,
    "content_norm" TEXT,
    "raw_payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "match_status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "confirmed_by" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "confirm_reason" TEXT,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "variant_id" TEXT NOT NULL DEFAULT '',
    "branch_id" TEXT NOT NULL DEFAULT '',
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" BIGSERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "inventory_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherTier" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "min_points_required" INTEGER NOT NULL DEFAULT 0,
    "min_lifetime_spend_vnd" BIGINT NOT NULL DEFAULT 0,
    "discount_amount_vnd" INTEGER NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "VoucherTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "min_order_value" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "max_discount" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "max_uses" INTEGER,
    "max_uses_per_customer" INTEGER DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherUsage" (
    "id" BIGSERIAL NOT NULL,
    "voucher_id" BIGINT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" BIGINT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "order_id" TEXT,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatLog" (
    "id" BIGSERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "customer_id" BIGINT,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'huggingface',
    "corrected_intent" TEXT,
    "is_annotated" BOOLEAN NOT NULL DEFAULT false,
    "is_trained" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "B2CCustomer_email_key" ON "B2CCustomer"("email");

-- CreateIndex
CREATE INDEX "Category_parent_id_idx" ON "Category"("parent_id");

-- CreateIndex
CREATE INDEX "Product_category_id_idx" ON "Product"("category_id");

-- CreateIndex
CREATE INDEX "Product_brand_id_idx" ON "Product"("brand_id");

-- CreateIndex
CREATE INDEX "Product_is_deleted_id_idx" ON "Product"("is_deleted", "id");

-- CreateIndex
CREATE INDEX "Product_price_idx" ON "Product"("price");

-- CreateIndex
CREATE INDEX "Wishlist_customer_id_idx" ON "Wishlist"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_customer_id_product_id_key" ON "Wishlist"("customer_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_payment_ref_key" ON "Order"("payment_ref");

-- CreateIndex
CREATE INDEX "Order_customer_id_idx" ON "Order"("customer_id");

-- CreateIndex
CREATE INDEX "Order_payment_status_expires_at_idx" ON "Order"("payment_status", "expires_at");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_date_idx" ON "Order"("date");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_idx" ON "OrderItem"("order_id");

-- CreateIndex
CREATE INDEX "OrderItem_product_id_idx" ON "OrderItem"("product_id");

-- CreateIndex
CREATE INDEX "OrderItem_category_id_idx" ON "OrderItem"("category_id");

-- CreateIndex
CREATE INDEX "OrderItem_brand_id_idx" ON "OrderItem"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_provider_txn_id_key" ON "PaymentTransaction"("provider_txn_id");

-- CreateIndex
CREATE INDEX "PaymentTransaction_order_id_idx" ON "PaymentTransaction"("order_id");

-- CreateIndex
CREATE INDEX "PaymentTransaction_match_status_idx" ON "PaymentTransaction"("match_status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_received_at_idx" ON "PaymentTransaction"("received_at");

-- CreateIndex
CREATE INDEX "Inventory_product_id_idx" ON "Inventory"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_product_id_variant_id_branch_id_key" ON "Inventory"("product_id", "variant_id", "branch_id");

-- CreateIndex
CREATE INDEX "StockReservation_order_id_idx" ON "StockReservation"("order_id");

-- CreateIndex
CREATE INDEX "StockReservation_status_expires_at_idx" ON "StockReservation"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "VoucherUsage_order_id_idx" ON "VoucherUsage"("order_id");

-- CreateIndex
CREATE INDEX "VoucherUsage_customer_id_idx" ON "VoucherUsage"("customer_id");

-- CreateIndex
CREATE INDEX "VoucherUsage_status_idx" ON "VoucherUsage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherUsage_voucher_id_order_id_key" ON "VoucherUsage"("voucher_id", "order_id");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_customer_id_idx" ON "LoyaltyTransaction"("customer_id");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_order_id_idx" ON "LoyaltyTransaction"("order_id");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_status_idx" ON "LoyaltyTransaction"("status");

-- CreateIndex
CREATE INDEX "ChatLog_session_id_idx" ON "ChatLog"("session_id");

-- CreateIndex
CREATE INDEX "ChatLog_customer_id_idx" ON "ChatLog"("customer_id");

-- CreateIndex
CREATE INDEX "ChatLog_intent_idx" ON "ChatLog"("intent");

-- CreateIndex
CREATE INDEX "ChatLog_is_annotated_idx" ON "ChatLog"("is_annotated");

-- CreateIndex
CREATE INDEX "ChatLog_created_at_idx" ON "ChatLog"("created_at");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
