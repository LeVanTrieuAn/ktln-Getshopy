"""FastAPI Application for AI Ecommerce Recommendation Service."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from api.schemas import (
    CustomerRecommendationResponse,
    HealthResponse,
)
from api.service import CFModelService
from config import DEFAULT_TOP_K, TRAIN_INITIAL_DELAY_SECONDS, TRAIN_INTERVAL_SECONDS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("recommendation_api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Nạp model đã lưu rồi bật vòng train nền.

    initialize() chỉ đọc file trên đĩa nên trả về gần như tức thì — API phục
    vụ được ngay. Việc lấy dữ liệu mới từ warehouse và train lại nằm hết trong
    tác vụ nền, vì train đồng bộ ở đây sẽ giữ cổng chưa mở cho tới khi xong,
    healthcheck của Docker hết giờ và container bị khai tử giữa chừng.
    """
    logger.info("Khởi động engine gợi ý...")
    service = CFModelService.get_instance()
    service.initialize()
    await service.start_background_training()
    logger.info(
        "Sẵn sàng. Vòng train nền chạy mỗi %ds (lần đầu sau %ds).",
        TRAIN_INTERVAL_SECONDS, TRAIN_INITIAL_DELAY_SECONDS,
    )
    yield
    await service.stop_background_training()
    logger.info("Đã dừng dịch vụ gợi ý.")


app = FastAPI(
    title="AI Ecommerce Recommendation System API",
    description=(
        "Production-ready REST API for Item-Based Collaborative Filtering recommendations. "
        "Provides product suggestions by CustomerID with in-memory inference caching."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root_redirect() -> RedirectResponse:
    """Redirect root path to interactive Swagger documentation."""
    return RedirectResponse(url="/docs")


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Healthcheck and Model Status",
    description="Returns the operational status of the service and summary of the loaded model.",
)
def healthcheck() -> HealthResponse:
    service = CFModelService.get_instance()
    return service.get_health()


@app.get(
    "/api/v1/recommend/customer/{customer_id}",
    response_model=CustomerRecommendationResponse,
    tags=["Recommendations"],
    summary="Recommend products for a Customer",
    description=(
        "Recommends unseen products for a customer using Item-based Collaborative Filtering. "
        "Falls back to global popular products if the customer has no past purchases (cold-start)."
    ),
)
def recommend_for_customer(
    customer_id: str = Path(..., description="ID của khách hàng (CustomerID)"),
    top_k: int = Query(
        DEFAULT_TOP_K,
        ge=1,
        le=50,
        description="Số lượng sản phẩm đề xuất tối đa",
    ),
) -> CustomerRecommendationResponse:
    service = CFModelService.get_instance()
    try:
        return service.recommend_for_customer(customer_id=customer_id, top_k=top_k)
    except Exception as exc:
        logger.error("Error generating recommendations for customer %s: %s", customer_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

