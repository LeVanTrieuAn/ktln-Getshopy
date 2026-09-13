# import json
# import random
# import os
# from datetime import datetime, timedelta
# from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
# from tqdm import tqdm

# # CẤU HÌNH SỐ LƯỢNG WORKERS (PROCESS) THEO PHẦN CỨNG MÁY BẠN
# MAX_WORKERS = os.cpu_count()  # Lấy tối đa số nhân CPU (Ví dụ: 8 Cores = 8 Workers)
# TOTAL_ORDERS = 50000         # Tổng số lượng đơn hàng bạn muốn sinh ra cho 12 tháng
# BATCH_SIZE = 5000             # Chia nhỏ dữ liệu thành các mẻ để ghi file, tránh tràn RAM

# def generate_order_batch(batch_id, num_orders_to_generate):
#     """
#     HÀM CHẠY TRÊN MULTI-WORKERS (PROCESS):
#     Mỗi Worker chịu trách nhiệm xử lý một mẻ dữ liệu độc lập trên 1 nhân CPU độc lập.
#     """
#     from faker import Faker  # Import bên trong để tránh lỗi luồng xử lý phân tán
#     fake = Faker()
    
#     orders_batch = []
#     start_date = datetime.now() - timedelta(days=365)
    
#     for _ in range(num_orders_to_generate):
#         # Tạo ngày ngẫu nhiên rải đều trong 12 tháng qua
#         random_days = random.randint(0, 364)
#         random_hour = random.randint(0, 23)
#         random_minute = random.randint(0, 59)
#         order_date = (start_date + timedelta(days=random_days)).replace(hour=random_hour, minute=random_minute)
        
#         customer_id = random.randint(1, 1000)
#         total_amount = round(random.uniform(20.0, 1500.0), 2)
#         status = random.choice(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'])
        
#         # Sinh dữ liệu chi tiết đơn hàng
#         num_items = random.randint(1, 4)
#         details = []
#         for _ in range(num_items):
#             details.append({
#                 "product_id": random.randint(100, 999),
#                 "quantity": random.randint(1, 5),
#                 "price": round(total_amount / num_items, 2)
#             })
            
#         orders_batch.append({
#             "customer_id": customer_id,
#             "total_amount": total_amount,
#             "status": status,
#             "created_at": order_date.isoformat(),
#             "details": details
#         })
        
#     return orders_batch

# def write_to_json_thread(data, filename):
#     """
#     HÀM CHẠY TRÊN MULTI-THREADS:
#     Chịu trách nhiệm ghi dữ liệu đã tính toán xong xuống ổ đĩa mà không làm nghẽn CPU chính.
#     """
#     with open(filename, 'w', encoding='utf-8') as f:
#         json.dump(data, f, ensure_ascii=False, indent=2)

# if __name__ == "__main__":
#     print(f"🚀 [Hệ thống song song] Kích hoạt {MAX_WORKERS} Workers CPU để sinh dữ liệu...")
    
#     # Chia nhỏ tổng số đơn hàng cần tạo thành các Tasks cho các cụm Process xử lý
#     tasks = []
#     remaining_orders = TOTAL_ORDERS
#     while remaining_orders > 0:
#         current_batch_size = min(BATCH_SIZE, remaining_orders)
#         tasks.append(current_batch_size)
#         remaining_orders -= current_batch_size

#     all_generated_orders = []
    
#     # ─── BƯỚC 1: MULTI-WORKERS (PROCESS POOL) ĐỂ TÍNH TOÁN DỮ LIỆU ĐA NHÂN ───
#     with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
#         futures = {executor.submit(generate_order_batch, i, size): size for i, size in enumerate(tasks)}
        
#         # Hiển thị thanh Progress Bar tiến độ sinh dữ liệu
#         for future in tqdm(as_completed(futures), total=len(futures), desc="🧬 Đang sinh dữ liệu"):
#             try:
#                 batch_result = future.result()
#                 all_generated_orders.extend(batch_result)
#             except Exception as e:
#                 print(f"❌ Worker gặp sự cố: {e}")

#     # ─── BƯỚC 2: MULTI-THREADS ĐỂ GHI FILE XUỐNG Ổ ĐĨA SIÊU NHANH ───
#     output_filename = "orders_mock_data2.json"
#     print(f"💾 Đang dùng Multi-threading để ép dữ liệu xuống file '{output_filename}'...")
    
#     with ThreadPoolExecutor(max_workers=2) as thread_executor:
#         # Bắn luồng ghi file chạy độc lập ngầm
#         disk_job = thread_executor.submit(write_to_json_thread, all_generated_orders, output_filename)
        
#         # Đợi luồng I/O hoàn thành
#         disk_job.result()

#     print(f"🎉 [Thành công] Đã tạo xong {len(all_generated_orders)} đơn hàng phân tán trong 12 tháng!")
#     print(f"📂 Kích thước file hiện tại: {os.path.getsize(output_filename) / (1024*1024):.2f} MB")



import json
import random
import os
from datetime import datetime, timedelta
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from tqdm import tqdm

# CẤU HÌNH SỐ LƯỢNG WORKERS
MAX_WORKERS = os.cpu_count() 
TOTAL_ORDERS = 10000         
BATCH_SIZE = 500             

# Danh mục sản phẩm Apple thực tế (Mock Catalog)
APPLE_PRODUCTS = [
    {"product_id": 101, "name": "iPhone 15 Pro Max 256GB", "price": 1199.00},
    {"product_id": 102, "name": "iPhone 15 Pro 128GB", "price": 999.00},
    {"product_id": 103, "name": "iPhone 15 128GB", "price": 799.00},
    {"product_id": 201, "name": "MacBook Pro 14-inch M3", "price": 1599.00},
    {"product_id": 202, "name": "MacBook Air 13-inch M2", "price": 999.00},
    {"product_id": 301, "name": "AirPods Pro (2nd gen)", "price": 249.00},
    {"product_id": 302, "name": "AirPods (3rd gen)", "price": 169.00},
    {"product_id": 401, "name": "iPad Pro 11-inch", "price": 799.00},
    {"product_id": 402, "name": "iPad Air", "price": 599.00},
    {"product_id": 501, "name": "Apple Watch Series 9", "price": 399.00},
    {"product_id": 502, "name": "Apple Watch Ultra 2", "price": 799.00},
    {"product_id": 601, "name": "AirTag 4-Pack", "price": 99.00},
    {"product_id": 602, "name": "MagSafe Charger", "price": 39.00}
]

def generate_order_batch(batch_id, num_orders_to_generate):
    orders_batch = []
    
    # Mô phỏng dữ liệu dồn dập cho "hôm nay" và khoảng thời gian gần đây (30 ngày qua)
    start_date = datetime.now() - timedelta(days=30)
    
    for _ in range(num_orders_to_generate):
        # Giờ mở cửa POS: 9h00 sáng đến 21h59 tối
        random_days = random.randint(0, 30)
        random_hour = random.randint(9, 21) 
        random_minute = random.randint(0, 59)
        random_second = random.randint(0, 59)
        
        order_time = (start_date + timedelta(days=random_days)).replace(
            hour=random_hour, minute=random_minute, second=random_second, microsecond=0
        )
        
        # Đơn vị POS thường thanh toán thành công ngay. Tỉ lệ: 95% Completed, 3% Failed, 2% Refunded
        status = random.choices(
            ['COMPLETED', 'FAILED', 'REFUNDED'], 
            weights=[95, 3, 2], 
            k=1
        )[0]
        
        # ID khách hàng vãng lai / có thẻ thành viên (1 -> 10000)
        customer_id = random.randint(1, 10000)
        
        # POS: Khách thường mua 1 thiết bị chính và vài phụ kiện (1 -> 3 items)
        num_items = random.choices([1, 2, 3, 4], weights=[60, 25, 10, 5], k=1)[0]
        details = []
        total_amount = 0.0
        
        # Lấy các sản phẩm không trùng nhau cho cùng 1 hoá đơn
        selected_products = random.sample(APPLE_PRODUCTS, num_items)
        
        for prod in selected_products:
            # Khách bán lẻ chủ yếu mua số lượng 1, rất hiếm khi mua sỉ
            quantity = random.choices([1, 2, 3], weights=[90, 8, 2], k=1)[0]
            price = prod["price"]
            
            line_total = quantity * price
            total_amount += line_total
            
            details.append({
                "product_id": prod["product_id"],
                "quantity": quantity,
                "price": price
            })
            
        orders_batch.append({
            "customer_id": customer_id,
            "total_amount": round(total_amount, 2),
            "status": status,
            "created_at": order_time.isoformat(),
            "updated_at": (order_time + timedelta(seconds=random.randint(1, 300))).isoformat(),  # POS xuất bill xong là chốt
            "details": details
        })
        
    return orders_batch

def write_to_json_thread(data, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    print(f"🚀 [Hệ thống song song] Kích hoạt {MAX_WORKERS} Workers CPU để sinh dữ liệu POS Apple...")
    
    tasks = []
    remaining_orders = TOTAL_ORDERS
    while remaining_orders > 0:
        current_batch_size = min(BATCH_SIZE, remaining_orders)
        tasks.append(current_batch_size)
        remaining_orders -= current_batch_size

    all_generated_orders = []
    
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(generate_order_batch, i, size): size for i, size in enumerate(tasks)}
        
        for future in tqdm(as_completed(futures), total=len(futures), desc="🧬 Đang sinh dữ liệu"):
            try:
                batch_result = future.result()
                all_generated_orders.extend(batch_result)
            except Exception as e:
                print(f"❌ Worker gặp sự cố: {e}")

    # Ghi file JSON
    output_filename = "mock_apple_pos_orders_10k_2.json"
    print(f"💾 Đang dùng Multi-threading để ép dữ liệu xuống file '{output_filename}'...")
    
    with ThreadPoolExecutor(max_workers=2) as thread_executor:
        disk_job = thread_executor.submit(write_to_json_thread, all_generated_orders, output_filename)
        disk_job.result()

    print(f"🎉 [Thành công] Đã tạo xong {len(all_generated_orders)} đơn hàng bán lẻ trong 30 ngày qua!")
    print(f"📂 Kích thước file hiện tại: {os.path.getsize(output_filename) / (1024*1024):.2f} MB")