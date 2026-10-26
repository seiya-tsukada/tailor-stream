"""Google アラートの RSS を取り込むプロバイダ

カテゴリ → RSS URL の対応は環境変数 GOOGLE_ALERTS_FEEDS（JSON）で持つ。未設定のカテゴリはスキップする。
"""

import calendar
import time
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any

import feedparser
import httpx

from backend.config import RSS_ACCEPT, RSS_DEFAULT_LANGUAGE, RSS_DEFAULT_REGION
from backend.feed.categories import Category
from backend.feed.provider import FetchedArticle, FetchResult

# feedparser の日付フィールド（struct_time, UTC）を優先順に並べたもの
_DATE_FIELDS = ("published_parsed", "updated_parsed")


def _entry_value(entry: Mapping[str, Any], key: str) -> str:
    value = entry.get(key)
    return value if isinstance(value, str) else ""


def _entry_published_at(entry: Mapping[str, Any], fallback: datetime) -> datetime:
    for field in _DATE_FIELDS:
        value = entry.get(field)
        if isinstance(value, time.struct_time):
            return datetime.fromtimestamp(calendar.timegm(value), tz=UTC)
    return fallback


def parse_feed(content: bytes, now: datetime) -> list[FetchedArticle]:
    """RSS / Atom の本文を FetchedArticle に変換する（日付が無い記事は取得時刻を使う）"""
    parsed = feedparser.parse(content)
    entries: list[Mapping[str, Any]] = [
        e for e in parsed.get("entries", []) if isinstance(e, Mapping)
    ]
    articles: list[FetchedArticle] = []
    for entry in entries:
        link = _entry_value(entry, "link") or _entry_value(entry, "id")
        if not link:
            continue
        articles.append(
            FetchedArticle(
                url=link,
                title=_entry_value(entry, "title"),
                snippet=_entry_value(entry, "summary") or None,
                source_name=None,
                published_at=_entry_published_at(entry, now),
                language=RSS_DEFAULT_LANGUAGE,
                region=RSS_DEFAULT_REGION,
                provider_article_id=_entry_value(entry, "id") or None,
            )
        )
    return articles


class GoogleAlertsRssProvider:
    def __init__(
        self,
        feeds: Mapping[str, str],
        client: httpx.Client,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._feeds = feeds
        self._client = client
        self._now = now or (lambda: datetime.now(UTC))

    @property
    def name(self) -> str:
        return "google_alerts_rss"

    def supports(self, category: Category) -> bool:
        return bool(self._feeds.get(category.id))

    def fetch_articles(self, category: Category) -> FetchResult:
        url = self._feeds[category.id]
        response = self._client.get(url, headers={"Accept": RSS_ACCEPT})
        response.raise_for_status()
        return FetchResult(articles=parse_feed(response.content, self._now()), request_units=1)
