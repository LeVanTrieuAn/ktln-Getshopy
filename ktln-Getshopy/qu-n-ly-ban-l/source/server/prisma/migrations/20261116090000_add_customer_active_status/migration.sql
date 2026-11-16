-- (16/11/2026) Trạng thái tài khoản khách cho chức năng quản lý khách hàng ở trang quản trị.
-- "Xoá" khách = vô hiệu hoá (is_active = false), không bao giờ DELETE: Order.customer_id là
-- BigInt trần không có FK, xoá dòng là để lại đơn / điểm / wishlist mồ côi.
--
-- Hai lệnh ALTER bên dưới sinh bằng `prisma migrate diff` (không viết tay — lý do như
-- migration add_customer_preference: lệch quy ước của Prisma là `migrate dev` lần sau báo drift).
--
-- An toàn trên bảng đang chạy (PostgreSQL 11+, production là 16):
--   * ADD COLUMN ... NOT NULL DEFAULT true với hằng số chỉ ghi vào catalog, KHÔNG viết lại
--     bảng — mọi dòng cũ đọc ra true (https://www.postgresql.org/docs/16/sql-altertable.html,
--     mục Notes). Khoá ACCESS EXCLUSIVE chỉ giữ trong tích tắc.
--   * deactivated_at cho phép NULL, không default -> cũng không viết lại bảng.
--   * Không ảnh hưởng CDC: Debezium chỉ bắt public.Order, public.OrderItem (table.include.list)
--     và không bắt DDL. sync-masterdata.sh / bootstrap chép B2CCustomer bằng danh sách cột
--     tường minh nên cột mới không làm lệch bảng masterdata.dim_customers.

-- AlterTable
ALTER TABLE "B2CCustomer" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
