import os
import time
import random
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from faker import Faker
from datetime import datetime, timedelta


load_dotenv()
fake = Faker()

# Cấu hình kết nối DB
DB_HOST = os.getenv("POSTGRES_SOURCE_HOST")
DB_PORT = os.getenv("POSTGRES_SOURCE_PORT", "5432")
DB_USER = os.getenv("POSTGRES_SOURCE_USER")
DB_PASSWORD = os.getenv("POSTGRES_SOURCE_PASSWORD")
DB_NAME = os.getenv("POSTGRES_SOURCE_DB")

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, database=DB_NAME
    )

def simulate_pos_stream():
    print("🚀 [POS SIMULATOR] Hệ thống giả lập máy POS Real-time bắt đầu chạy...")
    print("Ctrl + C để dừng script.")
    
    while True:
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            # Quyết định hành vi: 85% là đơn mới, 15% là update đơn cũ từ 12 tháng trước/quá khứ
            behavior = random.choices(["NEW_ORDER", "UPDATE_ORDER"], weights=[85, 15])[0]
            
            # Lấy một danh sách ID có sẵn trong DB để phục vụ việc giả lập UPDATE
            cur.execute("SELECT order_id FROM orders ORDER BY random() LIMIT 1;")
            row = cur.fetchone()
            existing_order_id = row[0] if row else None

            if behavior == "NEW_ORDER" or not existing_order_id:
                # --- KỊCH BẢN 1: MÁY POS PHÁT SINH ĐƠN HÀNG MỚI TINH ---
                customer_id = random.randint(1000, 9999)
                total_amount = float(random.randint(50, 500) * 1000) # Số tiền VNĐ
                status = "PENDING"
                now = datetime.now()
                one_hour_ago = now - timedelta(hours=1)

                # INSERT bảng cha và lấy RETURNING order_id chuẩn Production (Cách 3)
                cur.execute("""
                    INSERT INTO orders (customer_id, total_amount, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING order_id;
                """, (customer_id, total_amount, status, one_hour_ago, one_hour_ago))
                
                new_order_id = cur.fetchone()[0]

                # Tự sinh ngẫu nhiên 1-3 món ăn kèm theo cho bảng con
                details_batch = []
                for _ in range(random.randint(1, 3)):
                    details_batch.append((
                        new_order_id,
                        random.randint(1, 100), # product_id
                        random.randint(1, 5),   # quantity
                        float(random.randint(10, 150) * 1000) # price
                    ))
                
                if details_batch:
                    execute_values(cur, """
                        INSERT INTO orders_detail (order_id, product_id, quantity, price)
                        VALUES %s;
                    """, details_batch)
                
                print(f"📥 [NEW] Máy POS vừa bắn đơn mới: ID={new_order_id}, Khách={customer_id}, Số tiền={total_amount}đ")

            else:
                # --- KỊCH BẢN 2: MÁY POS CẬP NHẬT TRẠNG THÁI ĐƠN CŨ ---
                # Đơn hàng cũ trong quá khứ chuyển trạng thái ngẫu nhiên
                new_status = random.choice(["PROCESSING", "COMPLETED", "CANCELLED"])
                now = datetime.now()
                one_hour_ago = now - timedelta(hours=1)


                cur.execute("""
                    UPDATE orders 
                    SET status = %s, updated_at = %s 
                    WHERE order_id = %s;
                """, (new_status, one_hour_ago, existing_order_id))
                
                print(f"🔄 [UPDATE] Máy POS vừa cập nhật đơn cũ: ID={existing_order_id} -> Trạng thái mới: {new_status}")

            # Commit ngay lập tức để đẩy data lên DB theo thời gian thực
            conn.commit()

        except Exception as e:
            conn.rollback()
            print(f"❌ Lỗi dòng chảy dữ liệu: {e}")
        finally:
            cur.close()
            conn.close()
        
        # --- CẤU HÌNH TỐC ĐỘ NÃ DỮ LIỆU ---
        # Nghỉ ngẫu nhiên từ 1 đến 3 giây rồi lại bắn tiếp đơn tiếp theo
        time.sleep(random.uniform(0.05, 0.1))

if __name__ == "__main__":
    simulate_pos_stream()