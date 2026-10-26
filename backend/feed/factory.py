"""NEWS_PROVIDER の値から NewsProvider の実装を作る"""

from collections.abc import Iterator
from contextlib import contextmanager

import httpx

from backend.config import Settings
from backend.feed.google_alerts import GoogleAlertsRssProvider
from backend.feed.mock_provider import MockNewsProvider
from backend.feed.provider import NewsProvider


@contextmanager
def open_news_provider(settings: Settings) -> Iterator[NewsProvider]:
    if settings.news_provider == "mock":
        yield MockNewsProvider()
        return

    with httpx.Client(
        timeout=settings.rss_timeout_seconds,
        headers={"User-Agent": settings.rss_user_agent},
        follow_redirects=True,
    ) as client:
        yield GoogleAlertsRssProvider(settings.google_alerts_feeds, client)
