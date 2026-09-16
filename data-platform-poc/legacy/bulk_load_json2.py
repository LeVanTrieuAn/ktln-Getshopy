import os
import json
import psycopg2
from psycopg2.extras import execute_values  # CHUYỂN SANG DÙNG execute_values
from dotenv import load_dotenv
from tqdm import tqdm

# 1. NẠP BIẾN MÔI TRƯỜNG TỪ FILE .ENV
load_dotenv()

DB_HOST = os.getenv("POSTGRES_SOURCE_HOST")
DB_PORT = os.getenv("POSTGRES_SOURCE_PORT", "5432")
DB_USER = os.getenv("POSTGRES_SOURCE_USER")
DB_PASSWORD = os.getenv("POSTGRES_SOURCE_PASSWORD")
DB_NAME = os.getenv("POSTGRES_SOURCE_DB")

# Cấu hình kích thước mẻ nạp (Dùng execute_values có thể tăng lên 1000 - 5000 rất mượt)
BATCH_SIZE = 1000

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
        # Tắt tự động commit để kiểm soát transaction theo mẻ
        conn.autocommit = False 

        orders_batch = []
        progress_bar = tqdm(total=total_orders, desc="💾 Đang nạp dữ liệu")

        for idx, order in enumerate(orders_data, 1):
            # KHÔNG lấy nextval thủ công ở đây nữa. Bỏ hoàn toàn câu lệnh SELECT nextval.
            # Lưu tạm thông tin kèm mảng "details" vào thùng chứa để bóc tách theo mẻ
            orders_batch.append((
                order["customer_id"],
                order["total_amount"],
                order["status"],
                order["created_at"],
                order["updated_at"],
                order["details"]  # Giữ lại để map với ID cha sau khi insert
            ))

            # Khi đạt kích thước mẻ hoặc đến dòng cuối cùng của file
            if idx % BATCH_SIZE == 0 or idx == total_orders:
                
                # --- BƯỚC 1: LỌC DỮ LIỆU VÀ INSERT BẢNG CHA (orders) ---
                # Chỉ lấy các trường của bảng orders (bỏ trường "details" ở cuối ra)
                orders_to_insert = [x[:-1] for x in orders_batch]
                
                insert_orders_query = """
                    INSERT INTO orders (customer_id, total_amount, status, created_at, updated_at)
                    VALUES %s
                    RETURNING order_id;
                """
                # execute_values sẽ tự động băm mảng thành câu lệnh VALUES (c1,c2..), (c1,c2..) siêu nhanh
                execute_values(cur, insert_orders_query, orders_to_insert)
                
                # Lấy lại TOÀN BỘ danh sách ID tự tăng mà Postgres vừa sinh ra cho mẻ này
                returned_ids = [r[0] for r in cur.fetchall()]
                
                # --- BƯỚC 2: KHỚP ID CHA VÀ CHUẨN BỊ INSERT BẢNG CON (orders_detail) ---
                details_batch = []
                for b_idx, order_item in enumerate(orders_batch):
                    # Lấy đúng ID tương ứng dựa theo vị trí index trong mẻ
                    parent_order_id = returned_ids[b_idx]
                    
                    # Duyệt qua các item con của đơn hàng đó
                    for detail in order_item[-1]:  # order_item[-1] chính là mảng "details"
                        details_batch.append((
                            parent_order_id,
                            detail["product_id"],
                            detail["quantity"],
                            detail["price"]
                        ))
                
                # --- BƯỚC 3: INSERT CẢ MẺ VÀO BẢNG CON ---
                if details_batch:
                    insert_details_query = """
                        INSERT INTO orders_detail (order_id, product_id, quantity, price)
                        VALUES %s;
                    """
                    execute_values(cur, insert_details_query, details_batch)

                # Kiên cố hóa dữ liệu xuống đĩa cứng cho mẻ này
                conn.commit()
                
                # Cập nhật tiến trình và dọn dẹp bộ đệm RAM
                progress_bar.update(len(orders_batch))
                orders_batch.clear()

        progress_bar.close()
        
        # BỎ HOÀN TOÀN CÂU LỆNH setval() Ở ĐÂY. Database tự tăng chuẩn 100% không sợ lệch.
        print(f"\n🎉 [THÀNH CÔNG RỰC RỠ] Đã nạp kiên cố trọn vẹn {total_orders} đơn hàng vào Postgres!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Thảm họa xảy ra! Đã Rollback toàn bộ dữ liệu của mẻ lỗi. Chi tiết lỗi: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    bulk_load_data("mock_apple_pos_orders_10k_2.json")