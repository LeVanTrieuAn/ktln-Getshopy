"""Đọc dữ liệu train từ warehouse ClickHouse qua HTTP interface."""

from __future__ import annotations

import io
import logging

import httpx
import pandas as pd

from config import (
    CLICKHOUSE_PASSWORD,
    CLICKHOUSE_TIMEOUT_SECONDS,
    CLICKHOUSE_URL,
    CLICKHOUSE_USER,
    PREFERENCE_SIGNALS_QUERY,
    PRODUCT_FEATURES_QUERY,
    TRAINING_QUERY,
)

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = ["CustomerID", "ProductID", "Quantity"]
# Không bắt buộc: thiếu thì coi như mọi lần mua đều mới tinh (không giảm trọng số).
OPTIONAL_COLUMNS = ["DaysSince"]


class ClickHouseUnavailable(RuntimeError):
    """Không lấy được dữ liệu từ warehouse ở lần thử này."""


def is_configured() -> bool:
    return bool(CLICKHOUSE_URL)


def _query(sql: str, dtype: dict[str, str]) -> pd.DataFrame:
    """Chạy một câu SELECT ... FORMAT TabSeparatedWithNames, trả DataFrame.

    Dùng TabSeparatedWithNames chứ không phải Parquet: pandas cần pyarrow mới
    đọc được parquet, mà thêm một phụ thuộc nặng cho việc này là không đáng.
    """
    if not is_configured():
        raise ClickHouseUnavailable("Chưa đặt CLICKHOUSE_URL")

    try:
        response = httpx.post(
            f"{CLICKHOUSE_URL}/",
            content=sql.encode("utf-8"),
            headers={
                "X-ClickHouse-User": CLICKHOUSE_USER,
                "X-ClickHouse-Key": CLICKHOUSE_PASSWORD,
            },
            timeout=CLICKHOUSE_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise ClickHouseUnavailable(f"Không gọi được ClickHouse: {exc}") from exc

    if response.status_code != 200:
        # ClickHouse trả lỗi dưới dạng text thuần, cắt ngắn cho log khỏi loãng.
        raise ClickHouseUnavailable(
            f"ClickHouse trả {response.status_code}: {response.text[:300]}"
        )
    return pd.read_csv(io.StringIO(response.text), sep="\t", dtype=dtype)


def _require(df: pd.DataFrame, columns: list[str], what: str) -> None:
    missing = [c for c in columns if c not in df.columns]
    if missing:
        # Hợp đồng dữ liệu đã đổi mà không ai báo. Dừng hẳn còn hơn train trên
        # dữ liệu không hiểu được.
        raise ClickHouseUnavailable(f"{what} thiếu cột {missing}. Nhận được: {list(df.columns)}")


def fetch_training_data() -> pd.DataFrame:
    """Kéo toàn bộ tập train về dưới dạng DataFrame.

    Kéo TOÀN BỘ chứ không phải phần chênh lệch. Bảng nguồn là bảng tổng hợp —
    grain một dòng cho mỗi cặp (khách, sản phẩm) — nên khi khách mua lại một
    sản phẩm thì dòng CŨ bị đổi số lượng, không phải thêm dòng mới. Lấy "các
    dòng mới hơn lần trước" sẽ bỏ sót đúng những thay đổi đó, và sai một cách
    im lặng: model vẫn chạy, chỉ là học trên số lượng cũ.
    """
    df = _query(
        TRAINING_QUERY,
        dtype={"CustomerID": "string", "ProductID": "string", "Quantity": "int32"},
    )
    _require(df, REQUIRED_COLUMNS, "Tập train")
    logger.info("Đã lấy %d dòng tương tác từ warehouse.", len(df))
    return df


def fetch_product_features() -> pd.DataFrame:
    """Đặc trưng nội dung của các món ứng viên (serving.product_features)."""
    df = _query(
        PRODUCT_FEATURES_QUERY,
        dtype={"ProductID": "string", "ParentCategory": "string", "Brand": "string", "PriceBand": "string"},
    )
    _require(df, ["ProductID", "ParentCategory", "Brand", "PriceBand"], "Bảng đặc trưng")
    logger.info("Đã lấy đặc trưng của %d sản phẩm ứng viên.", len(df))
    return df


def fetch_preference_signals() -> pd.DataFrame:
    """Sở thích onboarding đã làm sạch (serving.customer_preference_signals)."""
    df = _query(
        PREFERENCE_SIGNALS_QUERY,
        dtype={"CustomerID": "string", "Dimension": "string", "Value": "string"},
    )
    _require(df, ["CustomerID", "Dimension", "Value", "Polarity"], "Bảng sở thích")
    logger.info("Đã lấy %d tín hiệu onboarding của %d khách.", len(df), df["CustomerID"].nunique())
    return df
