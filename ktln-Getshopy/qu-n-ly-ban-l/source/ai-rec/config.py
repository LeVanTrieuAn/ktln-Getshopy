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
# Bản hybrid (CF + content-based + tham số trộn) — artifact service phục vụ.
# item_cf.joblib chỉ còn là đường dự phòng khi nâng cấp từ bản thuần CF.
HYBRID_MODEL_PATH = OUTPUT_DIR / "hybrid" / "recommender.joblib"



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
# Không còn FINAL ở đây: nguồn giờ là VIEW, và view đã FINAL sẵn bên trong,
# đồng thời đã lọc sản phẩm quá ít người mua. Thêm FINAL lên view là lỗi cú pháp.
TRAINING_QUERY = (
    f"SELECT CustomerID, ProductID, Quantity, "
    # Số ngày kể từ lần mua gần nhất — tính ở ClickHouse để khỏi phải thống
    # nhất múi giờ giữa hai hệ.
    f"dateDiff('day', LastPurchasedAt, now()) AS DaysSince "
    f"FROM {CLICKHOUSE_TABLE} "
    f"WHERE Quantity > 0 "
    f"FORMAT TabSeparatedWithNames"
)

# ==============================================================================
# Giảm trọng số theo thời gian (time decay)
# ==============================================================================
# Quantity cộng dồn TOÀN BỘ lịch sử, nên một đơn ba tháng trước nặng ngang đơn
# hôm qua và gợi ý không theo kịp sở thích đang đổi.
#
# Trọng số:  w = Quantity * 0.5 ** (số ngày / HALF_LIFE)
#   mua hôm nay           -> giữ nguyên  100%
#   mua đúng HALF_LIFE ngày ->            50%
#   mua gấp đôi HALF_LIFE  ->            25%
#
# Chọn hàm mũ chứ không trừ tuyến tính: trừ tuyến tính sẽ về 0 rồi âm, còn hàm
# mũ giảm dần và luôn dương — món mua rất lâu vẫn còn chút ảnh hưởng thay vì
# biến mất đột ngột.
#
# HALF_LIFE = 0 để TẮT hẳn, quay lại hành vi cũ.
#
# 37 ngày: CHỌN TỪ PHÂN TÍCH DATA THẬT (08/10/2026) dựa trên median inter-purchase
# interval — dùng chung cho ma trận CF, kênh mua lại và độ phổ biến. Phân tích 
# 18,194 lần mua lại cho thấy median = 73 ngày → half-life = 37 ngày (73/2).
# Giá trị cũ (7 ngày) quá ngắn so với chu kỳ thực tế; 37 ngày phản ánh hành vi 
# đúng hơn. Nếu có data production thật với chu kỳ khác nhau theo danh mục thì 
# sẽ chuyển sang CATEGORY_HALF_LIFE_DAYS.
RECENCY_HALF_LIFE_DAYS = float(os.getenv("RECENCY_HALF_LIFE_DAYS", "37"))

# Category-aware half-life: Dict[ParentCategory, half_life_days]
# Dựa trên hành vi tiêu dùng thực tế trong đời sống (domain knowledge 2026):
#
# PHỤ KIỆN (mua thường xuyên):
#   cat-mobile-acc:  90 ngày — 40% người dùng thay phụ kiện điện thoại mỗi 4-6 tháng
#   cat-laptop-acc:  120 ngày — phụ kiện laptop ít thay hơn phụ kiện điện thoại
#   cat-camera:      180 ngày — phụ kiện máy ảnh (lens, filter) thay theo nhu cầu
#
# THIẾT BỊ AV (chu kỳ trung bình):
#   cat-av:          1,095 ngày (3 năm) — AV receiver/loa có chu kỳ 7-12 năm,
#                    upgrade công nghệ 3-5 năm
#
# THIẾT BỊ CHÍNH (chu kỳ dài):
#   cat-phone:       975 ngày (2.7 năm) — người dùng giữ điện thoại trung bình
#                    32 tháng (2026 consumer research)
#   cat-tablet:      1,095 ngày (3 năm) — 22.6% thay tablet mỗi 3-4 năm
#   cat-laptop:      1,460 ngày (4 năm) — doanh nghiệp 3-4 năm, cá nhân 5-7 năm
#
# Half-life = chu kỳ thay thế / 2 → giảm trọng số 50% tại mốc giữa chu kỳ.
#
# Format env var: "cat-mobile-acc:90,cat-laptop:1460" để override, hoặc để trống dùng mặc định.
_category_halflife_str = os.getenv("CATEGORY_HALF_LIFE_DAYS", "")
if _category_halflife_str.strip():
    try:
        CATEGORY_HALF_LIFE_DAYS = {
            k.strip(): float(v.strip())
            for k, v in (pair.split(":") for pair in _category_halflife_str.split(","))
        }
    except (ValueError, AttributeError):
        CATEGORY_HALF_LIFE_DAYS = None
else:
    # Mặc định: dựa trên hành vi tiêu dùng thực tế
    # tuỳ thuộc vào ngành và nhóm hàng sẽ điều chỉnh các chu kỳ thay thế khác nhau
    CATEGORY_HALF_LIFE_DAYS = {
        # Phụ kiện — chu kỳ ngắn
        "cat-mobile-acc": 90.0,
        "cat-laptop-acc": 120.0,
        "cat-camera": 180.0,
        # Thiết bị AV — chu kỳ trung bình
        "cat-av": 1095.0,
        # Thiết bị chính — chu kỳ dài
        "cat-phone": 975.0,
        "cat-tablet": 1095.0,
        "cat-laptop": 1460.0,
    }

# Thang của trọng số trong ma trận CF, sau khi đã giảm theo thời gian:
#   "linear" -> giữ nguyên số lượng (bản trước 01/10)
#   "log"    -> log(1 + ·) (Hu et al., 2008): mua 10 cái không nặng gấp 10 lần mua 1 cái
# Half-life và thang được chọn CÙNG LÚC trên validation (evaluation/benchmark.py).
CF_INPUT_SCALE = os.getenv("CF_INPUT_SCALE", "log")

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

# ==============================================================================
# Content-based + hybrid
# ==============================================================================
# Đặc trưng sản phẩm và sở thích onboarding — cả hai do dbt dựng trong `serving`
# (tài khoản ai_rec chỉ đọc được schema này). Xem models/content_based.py.
PRODUCT_FEATURES_TABLE = os.getenv("PRODUCT_FEATURES_TABLE", "serving.product_features")
PREFERENCE_SIGNALS_TABLE = os.getenv("PREFERENCE_SIGNALS_TABLE", "serving.customer_preference_signals")
PRODUCT_FEATURES_QUERY = (
    f"SELECT ProductID, ParentCategory, Brand, PriceBand, UnitsSold, CatalogSold, CellRank "
    f"FROM {PRODUCT_FEATURES_TABLE} FORMAT TabSeparatedWithNames"
)
PREFERENCE_SIGNALS_QUERY = (
    f"SELECT CustomerID, Dimension, Value, Polarity "
    f"FROM {PREFERENCE_SIGNALS_TABLE} FORMAT TabSeparatedWithNames"
)

# final = α·CF + (1−α)·CB + γ·mua_lại,  α = n/(n + k)  — xem models/hybrid.py.
#
# k và γ: CHỌN TRÊN VALIDATION (01/10/2026) theo luật khai báo trước — tối đa
#   NDCG@10 tổng thể với ràng buộc 2–3 món khách đã mua trong 10 gợi ý. Ràng buộc
#   là QUYẾT ĐỊNH SẢN PHẨM (chốt 01/10): không ràng buộc thì validation chọn γ = 5,
#   khi đó phần lớn ô là món đã mua và khám phá gần bằng 0.
# k = 0: khách đã mua dùng thuần CF cho phần khám phá — content-based không giúp
#   khách có lịch sử trên dữ liệu hiện tại; khách mới (n = 0) vẫn dùng thuần
#   content-based vì α(0) = 0.
HYBRID_CF_SHRINK_K = float(os.getenv("HYBRID_CF_SHRINK_K", "0"))
HYBRID_REPEAT_WEIGHT = float(os.getenv("HYBRID_REPEAT_WEIGHT", "1"))
# Cho phép gợi ý lại món đã mua (quyết định sản phẩm: áp cho MỌI sản phẩm).
HYBRID_ALLOW_REPEAT = os.getenv("HYBRID_ALLOW_REPEAT", "1") not in ("0", "false", "False")
# Kênh mua lại (chọn trên validation 01/10/2026: "order_freq"):
#   "order_freq" -> tần suất ĐƠN đã giảm theo thời gian (models/repeat.py). Cần
#                   bảng serving.purchase_events_for_AI_rec; bảng lỗi/thiếu thì tự
#                   rơi về "cf_weight" và /health báo repeat_model = false.
#   "cf_weight"  -> cách cũ (bản trước 01/10): trọng số của món trong ma trận CF.
REPEAT_SCORE = os.getenv("REPEAT_SCORE", "order_freq")
PURCHASE_EVENTS_TABLE = os.getenv("PURCHASE_EVENTS_TABLE", "serving.purchase_events_for_AI_rec")
PURCHASE_EVENTS_QUERY = (
    # Một dòng cho mỗi (khách, món, đơn). Số ngày tính ở ClickHouse, cùng cách
    # với TRAINING_QUERY, để hai kênh già đi theo cùng một đồng hồ.
    # Thêm ParentCategory để hỗ trợ category-aware half-life (08/10/2026).
    f"SELECT pe.CustomerID, pe.ProductID, "
    f"dateDiff('day', pe.OrderedAt, now()) AS DaysSince, "
    f"cf.ParentCategory "
    f"FROM {PURCHASE_EVENTS_TABLE} pe "
    f"LEFT JOIN serving.catalog_features cf ON cf.ProductID = pe.ProductID "
    f"FORMAT TabSeparatedWithNames"
)
# ==============================================================================
# Tín hiệu hành vi phụ cho ma trận hồ sơ của CF — xem models/behavior.py
# ==============================================================================
# "none" | "count" | "dwell" | "dwell+cart". Chọn trên validation như mọi tham số khác.
# Mặc định TẮT: hành vi đang có trong analytics.user_events là dữ liệu seed không liên
# quan tới gu mua (evaluation/README.md §Hạn chế) — bật lên chỉ thêm nhiễu.
CF_BEHAVIOR_MODE = os.getenv("CF_BEHAVIOR_MODE", "none")
CF_BEHAVIOR_VIEW_WEIGHT = float(os.getenv("CF_BEHAVIOR_VIEW_WEIGHT", "0.5"))
CF_BEHAVIOR_CART_WEIGHT = float(os.getenv("CF_BEHAVIOR_CART_WEIGHT", "1"))
CF_BEHAVIOR_WISH_WEIGHT = float(os.getenv("CF_BEHAVIOR_WISH_WEIGHT", "0.5"))
BEHAVIOR_TABLE = os.getenv("BEHAVIOR_TABLE", "serving.customer_product_events")
BEHAVIOR_QUERY = (
    f"SELECT CustomerID, ProductID, Views, DwellSec, Carts, Wishlists, "
    f"dateDiff('day', LastEventAt, now()) AS DaysSince "
    f"FROM {BEHAVIOR_TABLE} FORMAT TabSeparatedWithNames"
)

# Một lựa chọn onboarding nặng bằng bấy nhiêu lần mua khi dựng hồ sơ nội dung.
# CHƯA tinh chỉnh được: cần dữ liệu onboarding thật để đo (xem README đánh giá).
CB_ONBOARDING_PSEUDO_COUNT = float(os.getenv("CB_ONBOARDING_PSEUDO_COUNT", "1"))
