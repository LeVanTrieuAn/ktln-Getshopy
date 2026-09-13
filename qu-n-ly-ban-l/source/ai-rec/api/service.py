"""Service layer to manage Collaborative Filtering model life cycle and business logic."""

from __future__ import annotations

import logging

from api.schemas import (
    CustomerRecommendationResponse,
    HealthResponse,
    RecommendationItem,
)
from config import MODEL_PATH
from models.cf_recommendation import CollaborativeFiltering

logger = logging.getLogger(__name__)


class CFModelService:
    """Singleton service to load, cache, and serve the Collaborative Filtering model."""

    _instance: CFModelService | None = None

    def __init__(self) -> None:
        self.model = CollaborativeFiltering(model_path=MODEL_PATH)
        self.is_loaded = False

    @classmethod
    def get_instance(cls) -> CFModelService:
        if cls._instance is None:
            cls._instance = CFModelService()
        return cls._instance

    def initialize(self) -> None:
        """Load trained model from disk or train anew if missing."""
        if self.is_loaded:
            return

        if self.model.model_path.exists():
            logger.info("Loading pre-trained CF model from %s...", self.model.model_path)
            self.model.load_model()
        else:
            logger.warning(
                "Model artifact not found at %s. Training CF model from raw dataset...",
                self.model.model_path,
            )
            self.model.train()
            self.model.save_model()
            logger.info("Model trained and saved to %s.", self.model.model_path)

        self.is_loaded = True
        summary = self.model.summary()
        logger.info(
            "CF Model ready: %d customers, %d products, %d interactions.",
            summary["customers"],
            summary["products"],
            summary["interactions"],
        )

    def get_health(self) -> HealthResponse:
        """Return system status and trained matrix statistics."""
        if not self.is_loaded:
            return HealthResponse(
                status="initializing",
                model_name="Item-based Collaborative Filtering",
                model_loaded=False,
                customers=0,
                products=0,
                interactions=0,
                version="0.1.0",
            )
        summary = self.model.summary()
        return HealthResponse(
            status="ok",
            model_name="Item-based Collaborative Filtering",
            model_loaded=True,
            customers=summary["customers"],
            products=summary["products"],
            interactions=summary["interactions"],
            version="0.1.0",
        )

    def recommend_for_customer(
        self, customer_id: str, top_k: int = 10
    ) -> CustomerRecommendationResponse:
        """Generate top_k product recommendations for a customer."""
        if not self.is_loaded:
            raise RuntimeError("Model is not initialized.")

        raw_recs = self.model.recommend(customer_id=customer_id, top_k=top_k)
        items = [RecommendationItem(product_id=product_id) for product_id, _ in raw_recs]

        return CustomerRecommendationResponse(
            customer_id=customer_id,
            recommendations=items,
        )
