"""実 DB を使うテスト（TEST_DATABASE_URL があるときだけ実行）

前提: TEST_DATABASE_URL の DB に supabase/migrations と supabase/seed.sql を適用済みであること。
各テストはトランザクション内で実行し、最後にロールバックする。
"""

from collections.abc import Iterator
from datetime import timedelta

import pytest
from psycopg import Connection
from psycopg.rows import dict_row

from backend.db import DbConnection
from backend.feed.mock_provider import MockNewsProvider
from backend.ingestion.service import IngestionService
from backend.repositories.articles import ArticleUpsert, PgArticleRepository
from backend.repositories.categories import PgCategoryRepository
from backend.repositories.ingestion_runs import PgIngestionRunRepository


@pytest.fixture
def conn(test_database_url: str) -> Iterator[DbConnection]:
    with Connection.connect(
        test_database_url,
        prepare_threshold=None,
        row_factory=dict_row,
        options="-c search_path=tailor_stream",
    ) as connection:
        try:
            yield connection
        finally:
            connection.rollback()


def test_アクティブなカテゴリをsort_order順に返す(conn: DbConnection) -> None:
    categories = PgCategoryRepository(conn).list_active()
    assert [c.id for c in categories][:2] == ["ai", "web3"]
    assert PgCategoryRepository(conn).get_active("unknown") is None


def test_取り込んだ記事がフィードに出る(conn: DbConnection) -> None:
    articles = PgArticleRepository(conn)
    service = IngestionService(
        MockNewsProvider(), articles, PgIngestionRunRepository(conn), timedelta(hours=48)
    )
    [outcome] = service.ingest(
        [c for c in PgCategoryRepository(conn).list_active() if c.id == "ai"]
    )
    assert outcome.status == "succeeded"

    # 2回取り込んでも重複しない
    service.ingest([c for c in PgCategoryRepository(conn).list_active() if c.id == "ai"])

    feed = articles.list_feed(["ai"], 100)
    assert len(feed) == outcome.stored_count
    scores = [(a.popularity_score, a.published_at) for a in feed]
    assert scores == sorted(scores, reverse=True)
    assert all(a.category_ids == ["ai"] for a in feed)


def test_同じストーリーの記事は代表1件だけ返し期限切れは返さない(conn: DbConnection) -> None:
    conn.execute("insert into story_clusters (id) values ('test-cluster')")
    articles = PgArticleRepository(conn)
    now = conn.execute("select now() as now").fetchone()
    assert now is not None

    def row(article_id: str, score: float, expires_in_hours: float) -> ArticleUpsert:
        return ArticleUpsert(
            id=article_id,
            provider="test",
            provider_article_id=None,
            canonical_url=f"https://example.com/{article_id}",
            title=article_id,
            snippet=None,
            source_name=None,
            source_domain="example.com",
            language="ja",
            region=None,
            image_url=None,
            published_at=now["now"] - timedelta(hours=1),
            share_count=None,
            popularity_score=score,
            expires_at=now["now"] + timedelta(hours=expires_in_hours),
        )

    articles.upsert_for_category(
        "security",
        [row("t-low", 1.0, 1), row("t-high", 2.0, 1), row("t-solo", 0.5, 1), row("t-old", 9.0, -1)],
    )
    conn.execute("update articles set cluster_id = 'test-cluster' where id in ('t-low', 't-high')")

    feed = articles.list_feed(["security"], 100)
    ids = [a.id for a in feed if a.id.startswith("t-")]
    assert ids == ["t-high", "t-solo"]
