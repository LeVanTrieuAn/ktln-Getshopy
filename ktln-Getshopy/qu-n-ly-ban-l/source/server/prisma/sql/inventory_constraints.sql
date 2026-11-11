-- Ràng buộc tồn kho ở tầng DB (08/10/2026). Chạy MỖI LẦN server khởi động, sau bước đồng
-- bộ schema (docker-entrypoint.sh) — viết idempotent, chạy lại bao nhiêu lần cũng được.
--
-- Vì sao không phải migration: thư mục prisma/migrations/ bị .gitignore, nên máy clone mới
-- đồng bộ schema bằng `prisma db push` từ schema.prisma — mà schema.prisma không biểu diễn
-- được CHECK hay trigger. File này nằm ngoài migrations/ nên được commit và tới mọi máy.
--
-- Code ứng dụng vốn đã giữ các bất biến này (inventoryService: UPDATE có điều kiện
-- on_hand - reserved >= qty; syncProductStock sau mỗi lần đổi tồn). Ở đây chặn thêm một
-- lớp cho mọi đường ghi KHÔNG qua code đó: script seed, sửa tay bằng SQL, script viết sau.
-- Trước đây ghi sai thì không có lỗi nào báo ra — tồn âm hay Product.stock lệch tổng biến
-- thể chỉ lộ ra khi khách đặt hàng.

-- ── 1. CHECK ───────────────────────────────────────────────────────────────
-- NOT VALID rồi mới VALIDATE: máy nào lỡ có dòng sai sẵn thì ràng buộc vẫn chặn mọi lần
-- ghi MỚI và server vẫn khởi động được, chỉ in cảnh báo để sửa tay dòng cũ.
-- reserved <= on_hand: không giữ chỗ quá số hàng thật. commitReservations trừ cả hai cột
-- trong cùng một UPDATE nên trạng thái cuối vẫn thoả.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = '"Inventory"'::regclass AND conname = 'Inventory_on_hand_nonnegative') THEN
        ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_on_hand_nonnegative" CHECK (on_hand >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = '"Inventory"'::regclass AND conname = 'Inventory_reserved_nonnegative') THEN
        ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_reserved_nonnegative" CHECK (reserved >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = '"Inventory"'::regclass AND conname = 'Inventory_reserved_le_on_hand') THEN
        ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_reserved_le_on_hand" CHECK (reserved <= on_hand) NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    ALTER TABLE "Inventory" VALIDATE CONSTRAINT "Inventory_on_hand_nonnegative";
    ALTER TABLE "Inventory" VALIDATE CONSTRAINT "Inventory_reserved_nonnegative";
    ALTER TABLE "Inventory" VALIDATE CONSTRAINT "Inventory_reserved_le_on_hand";
EXCEPTION WHEN check_violation THEN
    RAISE WARNING 'Inventory có dòng cũ vi phạm ràng buộc tồn kho (tồn âm hoặc giữ chỗ vượt tồn). Ràng buộc vẫn chặn mọi lần ghi mới; dòng cũ cần sửa tay.';
END $$;

-- ── 2. Product.stock = tổng tồn khả dụng (on_hand - reserved) các biến thể ──
-- Trigger MỨC CÂU LỆNH với bảng chuyển tiếp, không phải mức dòng: ensure-inventory chèn
-- ~1,2 triệu dòng trong MỘT câu INSERT ... SELECT; trigger mức dòng sẽ chạy 1,2 triệu lần,
-- còn ở đây chỉ một lần và cập nhật mọi sản phẩm liên quan bằng một UPDATE.
-- Postgres không cho một trigger có bảng chuyển tiếp nghe nhiều sự kiện, nên tách 3 trigger
-- dùng chung một hàm. Sản phẩm không có dòng tồn kho nào thì không bị đụng — trừ khi vừa xoá
-- hết dòng của nó: khi đó stock = 0.
CREATE OR REPLACE FUNCTION inventory_sync_product_stock() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE "Product" p SET stock = s.total
        FROM (SELECT i.product_id, COALESCE(SUM(GREATEST(0, i.on_hand - i.reserved)), 0)::int AS total
              FROM "Inventory" i
              WHERE i.product_id IN (SELECT DISTINCT product_id FROM new_rows)
              GROUP BY i.product_id) s
        WHERE p.id = s.product_id AND p.stock IS DISTINCT FROM s.total;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE "Product" p SET stock = s.total
        FROM (SELECT i.product_id, COALESCE(SUM(GREATEST(0, i.on_hand - i.reserved)), 0)::int AS total
              FROM "Inventory" i
              WHERE i.product_id IN (SELECT product_id FROM new_rows
                                     UNION SELECT product_id FROM old_rows)
              GROUP BY i.product_id) s
        WHERE p.id = s.product_id AND p.stock IS DISTINCT FROM s.total;
    ELSE  -- DELETE
        UPDATE "Product" p
        SET stock = s.total
        FROM (SELECT d.product_id, COALESCE(SUM(GREATEST(0, i.on_hand - i.reserved)), 0)::int AS total
              FROM (SELECT DISTINCT product_id FROM old_rows) d
              LEFT JOIN "Inventory" i ON i.product_id = d.product_id
              GROUP BY d.product_id) s
        WHERE p.id = s.product_id AND p.stock IS DISTINCT FROM s.total;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS inventory_sync_product_stock_ins ON "Inventory";
CREATE TRIGGER inventory_sync_product_stock_ins
    AFTER INSERT ON "Inventory" REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION inventory_sync_product_stock();

DROP TRIGGER IF EXISTS inventory_sync_product_stock_upd ON "Inventory";
CREATE TRIGGER inventory_sync_product_stock_upd
    AFTER UPDATE ON "Inventory" REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION inventory_sync_product_stock();

DROP TRIGGER IF EXISTS inventory_sync_product_stock_del ON "Inventory";
CREATE TRIGGER inventory_sync_product_stock_del
    AFTER DELETE ON "Inventory" REFERENCING OLD TABLE AS old_rows
    FOR EACH STATEMENT EXECUTE FUNCTION inventory_sync_product_stock();

-- ── 3. Dọn biến thể mồ côi (v1..v5 từ bản seed cũ) & đồng bộ Product.stock ──
-- CHỈ xoá dòng mà biến thể KHÔNG còn trong Product.variants của chính sản phẩm đó —
-- cùng điều kiện với scripts/ensure-inventory.js.
--
-- Bản trước xoá MỌI dòng variant_id v1..v5. Nhưng v1, v2, v3... cũng là mã biến thể
-- HIỆN HÀNH do seed sinh ra: trên DB 600k sản phẩm, 1.200.534 / 1.200.539 dòng mang mã
-- v1..v5 và đều còn trong variants. File này chạy MỖI LẦN server khởi động
-- (docker-entrypoint.sh), nên mỗi lần restart là xoá sạch kho + mọi StockReservation
-- (kể cả giữ chỗ của đơn đang chờ thanh toán), rồi ensure-inventory.js tạo lại từ
-- variants[].stock với reserved = 0. Đã xảy ra thật 10/11/2026.
DO $$
BEGIN
    DELETE FROM "StockReservation" sr
    USING "Inventory" i
    WHERE sr.inventory_id = i.id
      AND i.variant_id IN ('v1', 'v2', 'v3', 'v4', 'v5')
      AND NOT EXISTS (
          SELECT 1 FROM "Product" p
          WHERE p.id = i.product_id
            AND (CASE WHEN jsonb_typeof(p.variants::jsonb) = 'string' THEN (p.variants #>> '{}')::jsonb
                      ELSE p.variants::jsonb END)
                @> jsonb_build_array(jsonb_build_object('id', i.variant_id))
      );

    DELETE FROM "Inventory" i
    WHERE i.variant_id IN ('v1', 'v2', 'v3', 'v4', 'v5')
      AND NOT EXISTS (
          SELECT 1 FROM "Product" p
          WHERE p.id = i.product_id
            AND (CASE WHEN jsonb_typeof(p.variants::jsonb) = 'string' THEN (p.variants #>> '{}')::jsonb
                      ELSE p.variants::jsonb END)
                @> jsonb_build_array(jsonb_build_object('id', i.variant_id))
      );
END $$;
