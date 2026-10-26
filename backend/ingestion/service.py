"""記事の取り込み: 取得 → 正規化 → articles / article_categories の upsert → ingestion_runs 記録"""

import logging
import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

import httpx

from backend.config import SCORE_WEIGHT_SHARE, UNTITLED_ARTICLE_TITLE
from backend.feed.categories import Category
from backend.feed.parse_utils import extract_domain, extract_original_url, sanitize_html
from backend.feed.provider import FetchedArticle, NewsProvider
from backend.feed.url import create_article_id, is_http_url, normalize_url
from backend.repositories.articles import ArticleRepository, ArticleUpsert
from backend.repositories.ingestion_runs import IngestionRunRepository

logger = logging.getLogger(__name__)

IngestStatus = Literal["succeeded", "failed", "skipped"]


@dataclass(frozen=True)
class IngestOutcome:
    category_id: str
    status: IngestStatus
    fetched_count: int
    stored_count: int


def compute_popularity_score(share_count: int | None) -> float:
    """人気度スコア（docs/SPEC.md §5 の簡易版。媒体数・媒体の重み・鮮度は後で加える）"""
    return SCORE_WEIGHT_SHARE * math.log1p(share_count or 0)


def normalize_article(
    fetched: FetchedArticle, provider: str, ttl: timedelta, now: datetime
) -> ArticleUpsert | None:
    """取得した記事を articles の行に変換する。URL が不正・掲載期限切れの記事は None"""
    canonical_url = normalize_url(extract_original_url(fetched.url))
    if not is_http_url(canonical_url):
        return None
    expires_at = fetched.published_at + ttl
    if expires_at <= now:
        return None

    return ArticleUpsert(
        id=create_article_id(canonical_url),
        provider=provider,
        provider_article_id=fetched.provider_article_id,
        canonical_url=canonical_url,
        title=sanitize_html(fetched.title) or UNTITLED_ARTICLE_TITLE,
        snippet=sanitize_html(fetched.snippet or "") or None,
        source_name=fetched.source_name,
        source_domain=extract_domain(canonical_url),
        language=fetched.language,
        region=fetched.region,
        image_url=fetched.image_url,
        # 未来日付の記事は取得時刻に揃える（並び順の先頭に居座らせない）
        published_at=min(fetched.published_at, now),
        share_count=fetched.share_count,
        popularity_score=compute_popularity_score(fetched.share_count),
        expires_at=expires_at,
    )


def _dedupe(articles: list[ArticleUpsert]) -> list[ArticleUpsert]:
    """同じ取得結果に同じ記事が複数あると upsert が衝突するので、先に出た1件に絞る"""
    seen: dict[str, ArticleUpsert] = {}
    for article in articles:
        seen.setdefault(article.id, article)
    return list(seen.values())


def _describe_error(err: Exception) -> str:
    """ingestion_runs.error に残す要約（URL などの詳細はログにだけ残す）"""
    if isinstance(err, httpx.HTTPStatusError):
        return f"{type(err).__name__}: status {err.response.status_code}"
    return type(err).__name__


class IngestionService:
    def __init__(
        self,
        provider: NewsProvider,
        articles: ArticleRepository,
        runs: IngestionRunRepository,
        article_ttl: timedelta,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._provider = provider
        self._articles = articles
        self._runs = runs
        self._ttl = article_ttl
        self._now = now or (lambda: datetime.now(UTC))

    def ingest(self, categories: list[Category]) -> list[IngestOutcome]:
        """カテゴリごとに取り込む。1カテゴリの失敗で他のカテゴリを止めない"""
        return [self.ingest_category(category) for category in categories]

    def ingest_category(self, category: Category) -> IngestOutcome:
        if not self._provider.supports(category):
            logger.info("取り込みをスキップ（プロバイダ未対応）: category=%s", category.id)
            return IngestOutcome(category.id, "skipped", 0, 0)

        run_id = self._runs.start(self._provider.name, category.id)
        fetched_count = 0
        request_units: int | None = None
        try:
            result = self._provider.fetch_articles(category)
            fetched_count = len(result.articles)
            request_units = result.request_units
            now = self._now()
            normalized = [
                article
                for fetched in result.articles
                if (article := normalize_article(fetched, self._provider.name, self._ttl, now))
            ]
            rows = _dedupe(normalized)
            self._articles.upsert_for_category(category.id, rows)
        except Exception as err:
            logger.exception("取り込みに失敗: category=%s run_id=%s", category.id, run_id)
            self._runs.finish(run_id, "failed", fetched_count, request_units, _describe_error(err))
            return IngestOutcome(category.id, "failed", fetched_count, 0)

        self._runs.finish(run_id, "succeeded", fetched_count, request_units, None)
        return IngestOutcome(category.id, "succeeded", fetched_count, len(rows))
