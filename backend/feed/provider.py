"""ニュースプロバイダのインターフェース

実装は NEWS_PROVIDER で切り替える（mock | google_alerts_rss）。
プロバイダは取得したままの値を返し、正規化（URL・ID・サニタイズ）は ingestion で行う。
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from backend.feed.categories import Category


@dataclass(frozen=True)
class FetchedArticle:
    url: str
    title: str
    snippet: str | None
    source_name: str | None
    published_at: datetime
    language: str
    region: str | None = None
    image_url: str | None = None
    share_count: int | None = None
    provider_article_id: str | None = None


@dataclass(frozen=True)
class FetchResult:
    articles: list[FetchedArticle]
    # API の消費単位（リクエスト数・トークンなど）。ingestion_runs.request_units に記録する
    request_units: int


class NewsProvider(Protocol):
    @property
    def name(self) -> str:
        """articles.provider / ingestion_runs.provider に記録する名前"""
        ...

    def supports(self, category: Category) -> bool:
        """このカテゴリを取り込めるか（False のカテゴリは取り込みをスキップする）"""
        ...

    def fetch_articles(self, category: Category) -> FetchResult: ...
