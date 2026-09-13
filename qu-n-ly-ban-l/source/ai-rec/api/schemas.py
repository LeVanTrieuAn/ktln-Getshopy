"""Pydantic request and response schemas for Recommendation API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RecommendationItem(BaseModel):
    """Chi tiết của một sản phẩm được gợi ý."""

    product_id: str = Field(..., description="Mã sản phẩm (ProductID)")


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
