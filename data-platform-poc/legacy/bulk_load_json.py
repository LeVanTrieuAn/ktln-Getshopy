import os
import json
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
from tqdm import tqdm

# 1. NẠP BIẾN MÔI TRƯỜNG TỪ FILE .ENV (BẢO MẬT)
load_dotenv()

DB_HOST = os.getenv("POSTGRES_SOURCE_HOST")
DB_PORT = os.getenv("POSTGRES_SOURCE_PORT", "5432")
DB_USER = os.getenv("POSTGRES_SOURCE_USER")
DB_PASSWORD = os.getenv("POSTGRES_SOURCE_PASSWORD")
DB_NAME = os.getenv("POSTGRES_SOURCE_DB")

# Cấu hình kích thước mẻ nạp (Khuyên dùng từ 10k - 50k để tối ưu RAM)
BATCH_SIZE = 500

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )

def bulk_load_data(json_file_path):
    if not os.path.exists(json_file_path):  
        print(f"❌ Không tìm thấy file dữ liệu mẫu tại: {json_file_path}")
        return

    print(f"📖 1. Đang đọc tệp dữ liệu lớn: {json_file_path}...")
    with open(json_file_path, 'r', encoding='utf-8') as f:
        orders_data = json.load(f)
    
    total_orders = len(orders_data)
    print(f"🚀 2. Kết nối Database thành công. Chuẩn bị Bulk Insert {total_orders} đơn hàng...")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Tắt chế độ tự động commit để gom toàn bộ dữ liệu vào transaction kiểm soát bằng tay
        conn.autocommit = False 

        # Khởi tạo các thùng chứa dữ liệu mẻ
        orders_batch = []
        details_batch = []
        
        # Thanh tiến trình tổng thể
        progress_bar = tqdm(total=total_orders, desc="💾 Đang nạp dữ liệu")

        for idx, order in enumerate(orders_data, 1):
            # Lấy thủ công SERIAL tiếp theo của bảng orders để làm khóa ngoại liên kết (Tránh nghẽn RETURNING)
            cur.execute("SELECT nextval('orders_order_id_seq');")
            next_order_id = cur.fetchone()[0]

            # Gom dữ liệu bảng cha (orders)
            orders_batch.append((
                next_order_id,
                order["customer_id"],
                order["total_amount"],
                order["status"],
                order["created_at"],
                order["updated_at"]
            ))

            # Gom toàn bộ dữ liệu bảng con (orders_detail) liên quan
            for detail in order["details"]:
                details_batch.append((
                    next_order_id,
                    detail["product_id"],
                    detail["quantity"],
                    detail["price"]
                ))

            # KHI THÙNG CHỨA ĐẠT KÍCH THƯỚC MẺ (BATCH_SIZE) -> BẮN CẢ CỤM XUỐNG ĐĨA CỨNG
            if idx % BATCH_SIZE == 0 or idx == total_orders:
                # 1. Bắn cả mẻ lệnh INSERT vào bảng cha
                execute_batch(cur, """
    INSERT INTO orders (order_id, customer_id, total_amount, status, created_at, updated_at)
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (order_id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at;
""", orders_batch)

                # 2. Bắn cả mẻ lệnh INSERT vào bảng con
                execute_batch(cur, """
                    INSERT INTO orders_detail (order_id, product_id, quantity, price)
                    VALUES (%s, %s, %s, %s);
                """, details_batch)

                # Commit kiên cố xuống ổ đĩa cứng và giải phóng bộ nhớ RAM đệm
                conn.commit()
                
                # Cập nhật thanh tiến trình và xóa trắng bộ đệm mẻ cũ
                progress_bar.update(len(orders_batch))
                orders_batch.clear()
                details_batch.clear()

        progress_bar.close()
        
        # Đồng bộ lại chuỗi tăng tự động (Sequence) của Postgres để tránh lỗi trùng ID khi chèn tay sau này
        cur.execute("SELECT setval('orders_order_id_seq', (SELECT MAX(order_id) FROM orders));")
        conn.commit()
        
        print(f"\n🎉 [THÀNH CÔNG RỰC RỠ] Đã nạp kiên cố trọn vẹn {total_orders} đơn hàng vào Postgres!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Thảm họa xảy ra! Đã Rollback toàn bộ dữ liệu để tránh rác DB. Chi tiết lỗi: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    # Đảm bảo bạn đã chạy script sinh file "orders_mock_data.json" trước đó nhé
    bulk_load_data("mock_apple_pos_orders_10k_2.json")