"""Pydantic request and response schemas for Recommendation API."""

from __future__ import annotations

from pydantic import BaseModel, Field


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
    last_error: str | None = Field(None, description="Lỗi của lần train gần nhất, nếu có")
