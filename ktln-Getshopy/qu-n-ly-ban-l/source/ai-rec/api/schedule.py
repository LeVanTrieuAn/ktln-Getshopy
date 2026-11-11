"""Lịch train theo giờ cố định trong ngày (vd. 22:00 giờ Việt Nam).

Chỉ gồm hàm thuần — không đọc đồng hồ, không ngủ — để kiểm thử được bằng một
`now` cố định. Vòng lặp dùng chúng nằm ở api/service.py.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Việt Nam không đổi giờ theo mùa: UTC+7 cố định là đủ khi image thiếu tzdata.
_VN_FALLBACK = timezone(timedelta(hours=7), "UTC+07")


def parse_hhmm(value: str) -> tuple[int, int]:
    """'22:00' -> (22, 0). Sai định dạng thì báo lỗi ngay lúc khởi động."""
    try:
        hour_s, minute_s = value.strip().split(":")
        hour, minute = int(hour_s), int(minute_s)
    except ValueError as exc:
        raise ValueError(f"TRAIN_DAILY_AT phải dạng HH:MM, nhận {value!r}") from exc
    if not (0 <= hour < 24 and 0 <= minute < 60):
        raise ValueError(f"TRAIN_DAILY_AT ngoài khoảng 00:00–23:59: {value!r}")
    return hour, minute


def get_tz(name: str) -> tzinfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return _VN_FALLBACK


def next_run(now: datetime, hour: int, minute: int) -> datetime:
    """Lần chạy kế tiếp, NGHIÊM NGẶT sau `now` (đúng giờ thì sang hôm sau)."""
    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def last_run(now: datetime, hour: int, minute: int) -> datetime:
    """Mốc chạy gần nhất đã qua (hoặc đúng bằng `now`)."""
    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate > now:
        candidate -= timedelta(days=1)
    return candidate


def missed(saved_at: datetime | None, now: datetime, hour: int, minute: int) -> bool:
    """Model lưu trước mốc chạy gần nhất -> đã lỡ một lượt (máy tắt lúc tới giờ)."""
    if saved_at is None:
        return True
    return saved_at < last_run(now, hour, minute)
