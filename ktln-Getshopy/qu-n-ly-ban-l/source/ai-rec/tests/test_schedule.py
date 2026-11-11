"""Lịch train theo giờ cố định (api/schedule.py)."""

from datetime import datetime, timedelta, timezone

import pytest

from api import schedule

VN = timezone(timedelta(hours=7))


def at(day, hour, minute=0):
    return datetime(2026, 11, day, hour, minute, tzinfo=VN)


def test_parse_hhmm():
    assert schedule.parse_hhmm("22:00") == (22, 0)
    assert schedule.parse_hhmm(" 7:05 ") == (7, 5)
    for bad in ("22", "24:00", "22:60", "abc"):
        with pytest.raises(ValueError):
            schedule.parse_hhmm(bad)


def test_next_run_same_day_and_rollover():
    assert schedule.next_run(at(11, 8), 22, 0) == at(11, 22)
    # Đúng 22:00 hoặc sau đó -> hôm sau (không chạy hai lần liền).
    assert schedule.next_run(at(11, 22), 22, 0) == at(12, 22)
    assert schedule.next_run(at(11, 23), 22, 0) == at(12, 22)


def test_last_run():
    assert schedule.last_run(at(11, 8), 22, 0) == at(10, 22)
    assert schedule.last_run(at(11, 23), 22, 0) == at(11, 22)


def test_missed_catch_up():
    # Train lúc 22:05 hôm qua, sáng nay bật máy -> không lỡ.
    assert not schedule.missed(at(10, 22, 5), at(11, 8), 22, 0)
    # Máy tắt cả tối qua (model từ hôm kia) -> lỡ, train bù.
    assert schedule.missed(at(9, 22, 5), at(11, 8), 22, 0)
    # Model của vòng 5 phút cũ lưu 21:47, khởi động lại 23:00 -> lỡ mốc 22:00.
    assert schedule.missed(at(11, 21, 47), at(11, 23), 22, 0)
    # Chưa có model nào -> train ngay.
    assert schedule.missed(None, at(11, 8), 22, 0)


def test_get_tz_fallback():
    assert schedule.get_tz("Khong/Ton_Tai").utcoffset(None) == timedelta(hours=7)
