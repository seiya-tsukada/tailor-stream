from datetime import UTC, datetime

import httpx
import pytest

from backend.feed.categories import SEED_CATEGORIES
from backend.feed.google_alerts import GoogleAlertsRssProvider, parse_feed
from tests.fakes import FIXED_NOW

AI, WEB3 = SEED_CATEGORIES[0], SEED_CATEGORIES[1]
FEED_URL = "https://www.google.com/alerts/feeds/000/111"

ATOM = b"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Google Alert - AI</title>
  <entry>
    <id>tag:google.com,2013:googlealerts/feed:1</id>
    <title type="html">&lt;b&gt;AI&lt;/b&gt; agents are here</title>
    <link href="https://www.google.com/url?rct=j&amp;sa=t&amp;url=https://example.com/ai&amp;ct=ga"/>
    <published>2026-10-26T09:30:00Z</published>
    <content type="html">Summary of &lt;b&gt;AI&lt;/b&gt;</content>
  </entry>
  <entry>
    <title>No date</title>
    <link href="https://example.com/no-date"/>
  </entry>
  <entry>
    <title>No link</title>
  </entry>
</feed>
"""


def test_parse_feedはリンクの無い記事を除き日付が無ければ取得時刻を使う() -> None:
    articles = parse_feed(ATOM, FIXED_NOW)

    assert [a.url for a in articles] == [
        "https://www.google.com/url?rct=j&sa=t&url=https://example.com/ai&ct=ga",
        "https://example.com/no-date",
    ]
    first, second = articles
    assert first.published_at == datetime(2026, 10, 26, 9, 30, tzinfo=UTC)
    assert first.provider_article_id == "tag:google.com,2013:googlealerts/feed:1"
    assert first.snippet is not None and "AI" in first.snippet
    assert first.language == "ja"
    assert second.published_at == FIXED_NOW


def test_RSS_URLが設定されたカテゴリだけ対応し取得する() -> None:
    requested: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested.append(str(request.url))
        return httpx.Response(200, content=ATOM)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        provider = GoogleAlertsRssProvider({"ai": FEED_URL}, client, now=lambda: FIXED_NOW)
        assert provider.supports(AI)
        assert not provider.supports(WEB3)

        result = provider.fetch_articles(AI)

    assert requested == [FEED_URL]
    assert len(result.articles) == 2
    assert result.request_units == 1


def test_HTTPエラーは例外にする() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        provider = GoogleAlertsRssProvider({"ai": FEED_URL}, client)
        with pytest.raises(httpx.HTTPStatusError):
            provider.fetch_articles(AI)
