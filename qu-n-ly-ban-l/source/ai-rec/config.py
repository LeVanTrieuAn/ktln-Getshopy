"""Centralized paths and runtime defaults for the project."""

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
