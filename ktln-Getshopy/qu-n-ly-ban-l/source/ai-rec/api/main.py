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
    RealtimeRecommendationRequest,
)
from api.service import CFModelService
from config import (
    DEFAULT_TOP_K,
    TRAIN_DAILY_AT,
    TRAIN_INITIAL_DELAY_SECONDS,
    TRAIN_INTERVAL_SECONDS,
    TRAIN_TIMEZONE,
)

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
    if TRAIN_DAILY_AT:
        logger.info("Sẵn sàng. Train mỗi ngày lúc %s (%s); lỡ lượt gần nhất thì train bù.",
                    TRAIN_DAILY_AT, TRAIN_TIMEZONE)
    else:
        logger.info("Sẵn sàng. Vòng train nền chạy mỗi %ds (lần đầu sau %ds).",
                    TRAIN_INTERVAL_SECONDS, TRAIN_INITIAL_DELAY_SECONDS)
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
        "Hybrid: Item-based CF + content-based (category, brand, price band) + repurchase, "
        "with onboarding 'not interested' categories/brands filtered out. Customers without "
        "any signal get popular products."
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


# 12/11/2026 — train chạy mỗi ngày một lần (22:00), nên khách mua trong ngày chưa thấy
# gợi ý đổi theo đơn vừa mua. Endpoint này nhận kèm danh sách món đã mua (server Node
# đọc từ Postgres) và ghép phần mới vào hồ sơ khách lúc suy luận. GET ở trên giữ nguyên;
# response cùng schema để server đọc hai đường như nhau. POST vì danh sách có thể dài
# (tới hàng trăm mã) — nhét vào query string thì đụng giới hạn độ dài URL.
@app.post(
    "/api/v1/recommend/realtime",
    response_model=CustomerRecommendationResponse,
    tags=["Recommendations"],
    summary="Recommend products, folding in purchases made after the last training run",
    description=(
        "Same hybrid as GET /api/v1/recommend/customer/{customer_id}, but the purchased product "
        "ids sent in the body are folded into the customer's profile at inference time and scored "
        "with the already-trained item similarity (no retraining). Items the trained profile already "
        "has keep their learned weights; ids unknown to the trained item space are ignored. When the "
        "list adds nothing new, the result is identical to the GET endpoint (precomputed cache)."
    ),
)
def recommend_realtime(body: RealtimeRecommendationRequest) -> CustomerRecommendationResponse:
    service = CFModelService.get_instance()
    try:
        return service.recommend_realtime(
            customer_id=body.customer_id,
            purchased_product_ids=body.purchased_product_ids,
            top_k=body.top_k,
        )
    except Exception as exc:
        logger.error("Error generating realtime recommendations for customer %s: %s", body.customer_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

