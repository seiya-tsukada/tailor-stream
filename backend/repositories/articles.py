from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Protocol

from backend.db import DbConnection


@dataclass(frozen=True)
class ArticleUpsert:
    """取り込み時に articles へ書き込む1行（正規化済み）"""

    id: str
    provider: str
    provider_article_id: str | None
    canonical_url: str
    title: str
    snippet: str | None
    source_name: str | None
    source_domain: str
    language: str
    region: str | None
    image_url: str | None
    published_at: datetime
    share_count: int | None
    popularity_score: float
    expires_at: datetime


@dataclass(frozen=True)
class FeedArticle:
    id: str
    canonical_url: str
    title: str
    snippet: str | None
    source_name: str | None
    source_domain: str
    language: str
    image_url: str | None
    published_at: datetime
    popularity_score: float
    cluster_id: str | None
    category_ids: list[str]


class ArticleRepository(Protocol):
    def list_feed(self, category_ids: list[str], limit: int) -> list[FeedArticle]: ...

    def upsert_for_category(self, category_id: str, articles: list[ArticleUpsert]) -> None: ...


class PgArticleRepository:
    def __init__(self, conn: DbConnection) -> None:
        self._conn = conn

    def list_feed(self, category_ids: list[str], limit: int) -> list[FeedArticle]:
        """選択カテゴリの掲載期限内の記事を、ストーリー（cluster_id）ごとに代表1件にして返す

        cluster_id が null の記事は1件で1ストーリーとして扱う。
        並び順は popularity_score 降順 → published_at 降順。
        """
        rows = self._conn.execute(
            """
            select *
            from (
              select distinct on (coalesce(a.cluster_id, a.id))
                a.id, a.canonical_url, a.title, a.snippet, a.source_name, a.source_domain,
                a.language, a.image_url, a.published_at, a.popularity_score, a.cluster_id,
                array(
                  select ac.category_id
                  from article_categories ac
                  where ac.article_id = a.id and ac.category_id = any(%(category_ids)s)
                  order by ac.category_id
                ) as category_ids
              from articles a
              where a.expires_at > now()
                and exists (
                  select 1
                  from article_categories ac
                  where ac.article_id = a.id and ac.category_id = any(%(category_ids)s)
                )
              order by coalesce(a.cluster_id, a.id), a.popularity_score desc, a.published_at desc
            ) story
            order by popularity_score desc, published_at desc, id
            limit %(limit)s
            """,
            {"category_ids": category_ids, "limit": limit},
        ).fetchall()
        return [FeedArticle(**row) for row in rows]

    def upsert_for_category(self, category_id: str, articles: list[ArticleUpsert]) -> None:
        """記事を upsert し、カテゴリとの対応を追加する（1トランザクション）"""
        if not articles:
            return
        with self._conn.transaction(), self._conn.cursor() as cur:
            cur.executemany(
                """
                insert into articles (
                  id, provider, provider_article_id, canonical_url, title, snippet,
                  source_name, source_domain, language, region, image_url, published_at,
                  share_count, popularity_score, expires_at
                ) values (
                  %(id)s, %(provider)s, %(provider_article_id)s, %(canonical_url)s, %(title)s,
                  %(snippet)s, %(source_name)s, %(source_domain)s, %(language)s, %(region)s,
                  %(image_url)s, %(published_at)s, %(share_count)s, %(popularity_score)s,
                  %(expires_at)s
                )
                on conflict (id) do update set
                  provider_article_id = excluded.provider_article_id,
                  title = excluded.title,
                  snippet = excluded.snippet,
                  source_name = coalesce(excluded.source_name, articles.source_name),
                  source_domain = excluded.source_domain,
                  language = excluded.language,
                  region = excluded.region,
                  image_url = coalesce(excluded.image_url, articles.image_url),
                  share_count = coalesce(excluded.share_count, articles.share_count),
                  popularity_score = excluded.popularity_score,
                  fetched_at = now()
                """,
                [asdict(article) for article in articles],
            )
            cur.executemany(
                """
                insert into article_categories (article_id, category_id)
                values (%s, %s)
                on conflict do nothing
                """,
                [(article.id, category_id) for article in articles],
            )
