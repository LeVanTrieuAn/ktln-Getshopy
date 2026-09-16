"""Centralized paths and runtime defaults for the project."""

import os
from pathlib import Path

# ==============================================================================
# Khởi tạo đường dẫn gốc của dự án (Project Root)
# ==============================================================================
PROJECT_ROOT = Path(__file__).resolve().parent

# ==============================================================================
# Cấu hình đường dẫn thư mục và file dữ liệu thô (Raw) & dữ liệu đã xử lý (Processed)
# ==============================================================================
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DATA_DIR = PROJECT_ROOT / "data" / "processed"

ORDERS_DATA_PATH = RAW_DATA_DIR / "orders.csv"
PRODUCTS_DATA_PATH = RAW_DATA_DIR / "products.csv"
CUSTOMERS_DATA_PATH = RAW_DATA_DIR / "customers.csv"

RAW_DATA_PATH = ORDERS_DATA_PATH if ORDERS_DATA_PATH.exists() else RAW_DATA_DIR / "sales.csv"
PROCESSED_DATA_PATH = ORDERS_DATA_PATH if ORDERS_DATA_PATH.exists() else PROCESSED_DATA_DIR / "sales_clean.csv"
TRAIN_DATA_PATH = ORDERS_DATA_PATH if ORDERS_DATA_PATH.exists() else PROCESSED_DATA_DIR / "train.csv"
VALIDATION_DATA_PATH = PROCESSED_DATA_DIR / "validation.csv"
TEST_DATA_PATH = PROCESSED_DATA_DIR / "test.csv"

# ==============================================================================
# Cấu hình đường dẫn lưu trữ Model (File mô hình đã huấn luyện)
# ==============================================================================
OUTPUT_DIR = PROJECT_ROOT / "output"
MODEL_DIR = OUTPUT_DIR / "cf"
MODEL_PATH = MODEL_DIR / "item_cf.joblib"



# ==============================================================================
# Số lượng sản phẩm gợi ý mặc định (Top-K Recommendations)
# ==============================================================================
DEFAULT_TOP_K = 10


# ==============================================================================
# Nguồn dữ liệu train: ClickHouse (warehouse)
# ==============================================================================
# Hợp đồng dữ liệu: docs/implement-phase/implement-plan/data-contract-warehouse.md §4
# Warehouse mở HTTP interface, AI-Rec tự gọi lấy theo lịch của mình.
#
# Tài khoản ai_rec chỉ có quyền SELECT trên database `serving`.
CLICKHOUSE_URL = os.getenv("CLICKHOUSE_URL", "").rstrip("/")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "ai_rec")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")
CLICKHOUSE_TABLE = os.getenv("CLICKHOUSE_TABLE", "serving.processed_data_for_AI_rec")

# Bảng là ReplacingMergeTree append-only -> BẮT BUỘC đọc kèm FINAL, nếu không
# một cặp (khách, sản phẩm) sẽ hiện ra nhiều lần với số lượng khác nhau.
# Quantity > 0 lọc ngay ở nguồn: dòng 0 là bia mộ của cặp đã bị huỷ, và model
# cũng loại chúng ở bước làm sạch — kéo về chỉ tốn băng thông.
TRAINING_QUERY = (
    f"SELECT CustomerID, ProductID, Quantity "
    f"FROM {CLICKHOUSE_TABLE} FINAL "
    f"WHERE Quantity > 0 "
    f"FORMAT TabSeparatedWithNames"
)

# ==============================================================================
# Chu kỳ train lại
# ==============================================================================
# CF item-based KHÔNG train tăng dần được: thêm một đơn là ma trận user-item
# đổi, vector chuẩn hoá của mọi sản phẩm liên quan đổi theo. Nên mỗi chu kỳ là
# một lần train lại toàn bộ. Bù lại việc đó rẻ — fit() chỉ dựng ma trận thưa và
# chuẩn hoá, KHÔNG nhân ma trận item x item (để dành lúc suy luận).
TRAIN_INTERVAL_SECONDS = int(os.getenv("TRAIN_INTERVAL_SECONDS", "300"))

# Đợi bao lâu trước lần train đầu sau khi service lên. Để CDC và dbt kịp chạy
# xong vòng đầu trên máy vừa khởi động.
TRAIN_INITIAL_DELAY_SECONDS = int(os.getenv("TRAIN_INITIAL_DELAY_SECONDS", "20"))

# Timeout khi gọi ClickHouse. Tập train lớn dần nên để rộng tay.
CLICKHOUSE_TIMEOUT_SECONDS = float(os.getenv("CLICKHOUSE_TIMEOUT_SECONDS", "120"))

# ==============================================================================
# Cache gợi ý tính sẵn
# ==============================================================================
# Sau mỗi lần train, tính trước top-K cho TOÀN BỘ khách đã có lịch sử mua.
# Đọc từ cache là tra một dict — không tốn phép nhân ma trận nào.
#
# Cache là TỐI ƯU, không phải điều kiện đúng đắn: khách không có trong cache
# (vừa mua lần đầu, chưa tới chu kỳ train sau) vẫn được tính tại chỗ từ chính
# model đó. Thiếu đường dự phòng này thì khách mới không có gợi ý suốt 5 phút.
PRECOMPUTE_ENABLED = os.getenv("PRECOMPUTE_ENABLED", "1") not in ("0", "false", "False")
PRECOMPUTE_TOP_K = int(os.getenv("PRECOMPUTE_TOP_K", "20"))
# Trần thời gian tính sẵn. Vượt thì dừng, phần khách còn lại rơi về tính tại
# chỗ — thà cache một phần còn hơn để chu kỳ train tràn sang chu kỳ kế tiếp.
PRECOMPUTE_BUDGET_SECONDS = float(os.getenv("PRECOMPUTE_BUDGET_SECONDS", "60"))
