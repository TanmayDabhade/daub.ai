"""Tests for point-in-time data clients.

The headline invariant: no client ever returns an event with
`published_at > as_of`. Network calls are mocked so the suite is hermetic.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from backtest.pit_data import edgar_pit, news_pit, macro_pit
from backtest.pit_data.cache import PITCache
from backtest.pit_data.types import PITEvent, Source, assert_pit


@pytest.fixture
def tmp_cache(tmp_path: Path) -> PITCache:
    return PITCache(tmp_path / "pit_test.db")


# --- Cache ---------------------------------------------------------------

class TestCache:
    def test_roundtrip(self, tmp_cache: PITCache):
        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 6, 1, tzinfo=timezone.utc)
        events = [
            PITEvent(
                source=Source.EDGAR,
                ticker="AAPL",
                published_at=datetime(2024, 3, 15, tzinfo=timezone.utc),
                title="10-Q Apple",
                url="https://sec.gov/x",
            ),
        ]
        assert tmp_cache.get(Source.EDGAR, "AAPL", start, end) is None
        tmp_cache.put(Source.EDGAR, "AAPL", start, end, events)
        loaded = tmp_cache.get(Source.EDGAR, "AAPL", start, end)
        assert loaded is not None and len(loaded) == 1
        assert loaded[0].title == "10-Q Apple"
        assert loaded[0].published_at == events[0].published_at

    def test_empty_list_is_cached(self, tmp_cache: PITCache):
        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 6, 1, tzinfo=timezone.utc)
        tmp_cache.put(Source.GDELT, "AAPL", start, end, [])
        loaded = tmp_cache.get(Source.GDELT, "AAPL", start, end)
        assert loaded == []  # cache hit, not None


# --- Types / guardrail --------------------------------------------------

class TestAssertPit:
    def test_filters_future_events(self):
        as_of = datetime(2024, 6, 1, tzinfo=timezone.utc)
        events = [
            PITEvent(Source.EDGAR, "AAPL", datetime(2024, 5, 1, tzinfo=timezone.utc), "past"),
            PITEvent(Source.EDGAR, "AAPL", datetime(2024, 7, 1, tzinfo=timezone.utc), "future"),
        ]
        kept = assert_pit(events, as_of)
        assert len(kept) == 1
        assert kept[0].title == "past"


# --- EDGAR PIT ----------------------------------------------------------

class TestEdgarPit:
    @pytest.mark.asyncio
    async def test_filters_by_as_of(self, monkeypatch, tmp_cache):
        async def fake_get_recent_filings(ticker, filing_types, limit):
            return [
                {"filing_type": "10-Q", "filing_date": "2024-02-01", "company_name": "Apple", "url": "u1", "accession_number": "a1"},
                {"filing_type": "8-K",  "filing_date": "2024-05-15", "company_name": "Apple", "url": "u2", "accession_number": "a2"},
                {"filing_type": "10-Q", "filing_date": "2024-08-01", "company_name": "Apple", "url": "u3", "accession_number": "a3"},
            ]
        monkeypatch.setattr(edgar_pit.edgar_client, "get_recent_filings", fake_get_recent_filings)

        as_of = datetime(2024, 6, 1, tzinfo=timezone.utc)
        events = await edgar_pit.fetch("AAPL", as_of, lookback_days=365, cache=tmp_cache)

        assert len(events) == 2
        assert all(e.published_at <= as_of for e in events)
        assert all(e.source == Source.EDGAR for e in events)
        assert {e.extra["filing_type"] for e in events} == {"10-Q", "8-K"}

    @pytest.mark.asyncio
    async def test_cache_prevents_refetch(self, monkeypatch, tmp_cache):
        calls = {"n": 0}

        async def fake_get_recent_filings(ticker, filing_types, limit):
            calls["n"] += 1
            return [{"filing_type": "10-Q", "filing_date": "2024-02-01", "company_name": "Apple", "url": "u1", "accession_number": "a1"}]

        monkeypatch.setattr(edgar_pit.edgar_client, "get_recent_filings", fake_get_recent_filings)

        as_of = datetime(2024, 6, 1, tzinfo=timezone.utc)
        await edgar_pit.fetch("AAPL", as_of, cache=tmp_cache)
        await edgar_pit.fetch("AAPL", as_of, cache=tmp_cache)
        assert calls["n"] == 1


# --- GDELT PIT ----------------------------------------------------------

class FakeHttpxResponse:
    def __init__(self, data):
        self._data = data
    def raise_for_status(self):
        pass
    def json(self):
        return self._data


class FakeAsyncClient:
    def __init__(self, data):
        self._data = data
    async def __aenter__(self):
        return self
    async def __aexit__(self, *a):
        return False
    async def get(self, url, params=None):
        return FakeHttpxResponse(self._data)


class TestGdeltPit:
    @pytest.mark.asyncio
    async def test_filters_by_as_of(self, monkeypatch, tmp_cache):
        fake = {
            "articles": [
                {"seendate": "20240301T120000Z", "title": "Apple rumor", "url": "u1", "domain": "reuters.com", "language": "English"},
                {"seendate": "20240715T090000Z", "title": "Future news",  "url": "u2", "domain": "reuters.com", "language": "English"},
            ]
        }
        monkeypatch.setattr(news_pit.httpx, "AsyncClient", lambda **kw: FakeAsyncClient(fake))

        as_of = datetime(2024, 6, 1, tzinfo=timezone.utc)
        events = await news_pit.fetch("AAPL", as_of, lookback_days=180, company_name="Apple Inc.", cache=tmp_cache)

        assert len(events) == 1
        assert events[0].title == "Apple rumor"
        assert all(e.source == Source.GDELT for e in events)

    @pytest.mark.asyncio
    async def test_gdelt_failure_returns_empty(self, monkeypatch, tmp_cache):
        class FailClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return False
            async def get(self, *a, **kw): raise RuntimeError("boom")
        monkeypatch.setattr(news_pit.httpx, "AsyncClient", lambda **kw: FailClient())

        as_of = datetime(2024, 6, 1, tzinfo=timezone.utc)
        events = await news_pit.fetch("AAPL", as_of, cache=tmp_cache)
        assert events == []


# --- ALFRED PIT ---------------------------------------------------------

class TestMacroPit:
    @pytest.mark.asyncio
    async def test_filters_by_as_of(self, monkeypatch, tmp_cache):
        fake = {
            "observations": [
                {"date": "2024-02-01", "value": "3.2", "realtime_start": "2024-03-12", "realtime_end": "2024-03-12"},
                {"date": "2024-05-01", "value": "3.4", "realtime_start": "2024-06-12", "realtime_end": "2024-06-12"},
                {"date": "2024-07-01", "value": "2.9", "realtime_start": "2024-08-14", "realtime_end": "2024-08-14"},
            ]
        }
        monkeypatch.setattr(macro_pit, "FRED_API_KEY", "test-key")
        monkeypatch.setattr(macro_pit.httpx, "AsyncClient", lambda **kw: FakeAsyncClient(fake))

        as_of = datetime(2024, 6, 1, tzinfo=timezone.utc)
        events = await macro_pit.fetch("CPIAUCSL", as_of, lookback_days=365, cache=tmp_cache)

        assert len(events) == 1
        assert events[0].extra["value"] == 3.2
        assert events[0].published_at <= as_of

    @pytest.mark.asyncio
    async def test_missing_key_returns_empty(self, monkeypatch, tmp_cache):
        monkeypatch.setattr(macro_pit, "FRED_API_KEY", "")
        events = await macro_pit.fetch("CPIAUCSL", datetime(2024, 6, 1, tzinfo=timezone.utc), cache=tmp_cache)
        assert events == []

    @pytest.mark.asyncio
    async def test_skips_missing_values(self, monkeypatch, tmp_cache):
        fake = {
            "observations": [
                {"date": "2024-02-01", "value": ".", "realtime_start": "2024-03-12"},
                {"date": "2024-05-01", "value": "3.4", "realtime_start": "2024-05-12"},
            ]
        }
        monkeypatch.setattr(macro_pit, "FRED_API_KEY", "test-key")
        monkeypatch.setattr(macro_pit.httpx, "AsyncClient", lambda **kw: FakeAsyncClient(fake))

        as_of = datetime(2024, 6, 1, tzinfo=timezone.utc)
        events = await macro_pit.fetch("UNRATE", as_of, cache=tmp_cache)
        assert len(events) == 1
        assert events[0].extra["value"] == 3.4
