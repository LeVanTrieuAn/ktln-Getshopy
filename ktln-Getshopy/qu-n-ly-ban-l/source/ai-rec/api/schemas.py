"""Pydantic request and response schemas for Recommendation API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from config import DEFAULT_TOP_K, REALTIME_MAX_PURCHASES


class RealtimeRecommendationRequest(BaseModel):
    """Body của POST /api/v1/recommend/realtime (12/11/2026).

    Chỉ nhận MÃ món đã mua — đơn đã thanh toán, không huỷ, đúng định nghĩa của tập
    train (dbt purchase_events_for_AI_rec) — chưa nhận hành vi xem/giỏ: phạm vi
    giai đoạn 1 người dùng đã duyệt.
    """

    # Server Node đọc product_id từ Postgres (BigInt): gửi số thay vì chuỗi cũng phải
    # được nhận, vì mã chỉ dùng để tra như chuỗi — đúng cách tập train ép toString().
    model_config = ConfigDict(coerce_numbers_to_str=True)

    customer_id: str = Field(..., min_length=1, max_length=64, description="Mã khách hàng (CustomerID)")
    purchased_product_ids: list[str] = Field(
        default_factory=list,
        max_length=REALTIME_MAX_PURCHASES,
        description="Mã các món khách đã mua tới lúc gọi (mới nhất trước). Món bản train "
                    "đã biết giữ trọng số cũ; mã lạ (món mới tinh) bị bỏ qua.",
    )
    top_k: int = Field(DEFAULT_TOP_K, ge=1, le=50, description="Số lượng sản phẩm đề xuất tối đa")


class RecommendationItem(BaseModel):
    """Chi tiết của một sản phẩm được gợi ý."""

    product_id: str = Field(..., description="Mã sản phẩm (ProductID)")
    # Kênh đóng góp nhiều nhất vào điểm của món — để giao diện giải thích được
    # "vì sao gợi ý món này". Có giá trị mặc định: bên gọi cũ bỏ qua được.
    reason: str | None = Field(
        None, description="cf | content | repeat | popular — kênh chính đưa món này lên"
    )


class CustomerRecommendationResponse(BaseModel):
    """Kết quả gợi ý sản phẩm cho một khách hàng."""

    customer_id: str = Field(..., description="Mã khách hàng")
    recommendations: list[RecommendationItem] = Field(
        default_factory=list, description="Danh sách sản phẩm được AI đề xuất"
    )


class HealthResponse(BaseModel):
    """Trạng thái sức khỏe dịch vụ và thông số mô hình."""

    status: str = Field(..., example="ok")
    model_name: str = Field(..., example="Item-based Collaborative Filtering")
    model_loaded: bool = Field(...)
    customers: int = Field(..., description="Tổng số khách hàng trong mô hình")
    products: int = Field(..., description="Tổng số sản phẩm trong mô hình")
    interactions: int = Field(..., description="Tổng số tương tác giao dịch")
    version: str = Field(..., example="0.1.0")
    # ── Thông tin vòng đời model ────────────────────────────────────────
    # Thêm ở cuối và đều có giá trị mặc định: bên gọi cũ (server Node) đọc theo
    # tên trường nên thêm trường mới không làm hỏng gì.
    model_version: int = Field(0, description="Số thứ tự bản train, tăng sau mỗi lần swap")
    trained_at: str | None = Field(None, description="Thời điểm train xong (UTC)")
    data_source: str | None = Field(None, description="clickhouse | csv | disk")
    cached_customers: int = Field(0, description="Số khách đã có gợi ý tính sẵn")
    candidates: int = Field(0, description="Số món ứng viên (đang bán, có đặc trưng)")
    onboarded_customers: int = Field(0, description="Số khách có tín hiệu onboarding")
    content_based: bool = Field(False, description="False = đang chạy thuần CF (thiếu bảng đặc trưng)")
    repeat_model: bool = Field(
        False, description="True = kênh mua lại theo tần suất đơn; False = cách cũ (trọng số ma trận CF)"
    )
    behavior: bool = Field(
        False, description="True = ma trận hồ sơ CF có tín hiệu hành vi phụ (xem/giỏ/yêu thích)"
    )
    last_error: str | None = Field(None, description="Lỗi của lần train gần nhất, nếu có")
