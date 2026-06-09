"""Tests for daily review file scanning and generation helpers."""

from __future__ import annotations

from datetime import date

import pytest

from app.daily_review.service import (
    DailyReviewSource,
    NoDailyReviewSourcesError,
    collect_daily_review_sources,
)


def test_collect_sources_filters_by_local_date_and_ignored_dirs(tmp_path):
    target = date(2026, 6, 6)
    morning = tmp_path / "morning.md"
    morning.write_text("早上散步，想到一个新想法。", encoding="utf-8")
    yesterday = tmp_path / "yesterday.md"
    yesterday.write_text("昨天的记录", encoding="utf-8")
    ignored_dir = tmp_path / "node_modules"
    ignored_dir.mkdir()
    ignored_file = ignored_dir / "package.json"
    ignored_file.write_text('{"ignored": true}', encoding="utf-8")

    # Use fixed timestamps in local time: 2026-06-06 09:15 and previous day.
    import time

    morning_epoch = time.mktime((2026, 6, 6, 9, 15, 0, 0, 0, -1))
    yesterday_epoch = time.mktime((2026, 6, 5, 18, 0, 0, 0, 0, -1))
    ignored_epoch = time.mktime((2026, 6, 6, 12, 0, 0, 0, 0, -1))
    morning.touch()
    yesterday.touch()
    ignored_file.touch()
    import os

    os.utime(morning, (morning_epoch, morning_epoch))
    os.utime(yesterday, (yesterday_epoch, yesterday_epoch))
    os.utime(ignored_file, (ignored_epoch, ignored_epoch))

    sources = collect_daily_review_sources(tmp_path, target)

    assert sources == [
        DailyReviewSource(
            path=str(morning.resolve()),
            relative_path="morning.md",
            modified_at="2026-06-06 09:15",
            content="早上散步，想到一个新想法。",
            size=morning.stat().st_size,
            truncated=False,
        )
    ]


def test_collect_sources_truncates_large_files(tmp_path):
    target = date(2026, 6, 6)
    note = tmp_path / "long.txt"
    note.write_text("abcdef", encoding="utf-8")

    import os
    import time

    epoch = time.mktime((2026, 6, 6, 10, 0, 0, 0, 0, -1))
    os.utime(note, (epoch, epoch))

    sources = collect_daily_review_sources(
        tmp_path,
        target,
        max_file_bytes=3,
        max_total_chars=100,
    )

    assert len(sources) == 1
    assert sources[0].content == "abc"
    assert sources[0].truncated is True


def test_collect_sources_raises_for_empty_day(tmp_path):
    with pytest.raises(NoDailyReviewSourcesError):
        collect_daily_review_sources(tmp_path, date(2026, 6, 6))
