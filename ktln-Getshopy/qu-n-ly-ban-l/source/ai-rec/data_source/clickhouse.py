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
    TRAINING_QUERY,
)

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = ["CustomerID", "ProductID", "Quantity"]


class ClickHouseUnavailable(RuntimeError):
    """Không lấy được dữ liệu từ warehouse ở lần thử này."""


def is_configured() -> bool:
    return bool(CLICKHOUSE_URL)


def fetch_training_data() -> pd.DataFrame:
    """Kéo toàn bộ tập train về dưới dạng DataFrame.

    Kéo TOÀN BỘ chứ không phải phần chênh lệch. Bảng nguồn là bảng tổng hợp —
    grain một dòng cho mỗi cặp (khách, sản phẩm) — nên khi khách mua lại một
    sản phẩm thì dòng CŨ bị đổi số lượng, không phải thêm dòng mới. Lấy "các
    dòng mới hơn lần trước" sẽ bỏ sót đúng những thay đổi đó, và sai một cách
    im lặng: model vẫn chạy, chỉ là học trên số lượng cũ.

    Dùng TabSeparatedWithNames chứ không phải Parquet: pandas cần pyarrow mới
    đọc được parquet, mà thêm một phụ thuộc nặng cho việc này là không đáng.
    """
    if not is_configured():
        raise ClickHouseUnavailable("Chưa đặt CLICKHOUSE_URL")

    try:
        response = httpx.post(
            f"{CLICKHOUSE_URL}/",
            content=TRAINING_QUERY.encode("utf-8"),
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

    df = pd.read_csv(
        io.StringIO(response.text),
        sep="\t",
        dtype={"CustomerID": "string", "ProductID": "string", "Quantity": "int32"},
    )

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        # Hợp đồng dữ liệu đã đổi mà không ai báo. Dừng hẳn còn hơn train trên
        # dữ liệu không hiểu được.
        raise ClickHouseUnavailable(
            f"Warehouse thiếu cột {missing}. Nhận được: {list(df.columns)}"
        )

    logger.info("Đã lấy %d dòng tương tác từ warehouse.", len(df))
    return df
