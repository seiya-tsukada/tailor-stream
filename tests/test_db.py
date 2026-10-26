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
from backend.repositories.login_tokens import PgLoginTokenRepository
from backend.repositories.sessions import PgSessionRepository
from backend.repositories.user_categories import (
    CategoryLimitExceededError,
    PgUserCategoryRepository,
    UnknownCategoryError,
)
from backend.repositories.users import PgUserRepository


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


# =============================================================
# 認証・ユーザーデータ
# =============================================================


def test_ログイントークンは1回だけ消費でき期限切れは消費できない(conn: DbConnection) -> None:
    tokens = PgLoginTokenRepository(conn)
    now = conn.execute("select now() as now").fetchone()
    assert now is not None
    tokens.create("db@example.com", "hash-valid", now["now"] + timedelta(minutes=15), "203.0.113.1")
    tokens.create("db@example.com", "hash-expired", now["now"] - timedelta(seconds=1), None)

    assert tokens.consume("hash-valid") == "db@example.com"
    assert tokens.consume("hash-valid") is None
    assert tokens.consume("hash-expired") is None
    assert tokens.count_recent_by_email("db@example.com", now["now"] - timedelta(minutes=15)) == 2
    assert tokens.count_recent_by_ip("203.0.113.1", now["now"] - timedelta(hours=1)) == 1


def test_ユーザーのupsertとセッション(conn: DbConnection) -> None:
    users = PgUserRepository(conn)
    first = users.upsert_on_login("db@example.com")
    again = users.upsert_on_login("db@example.com")
    assert first.id == again.id
    assert first.plan == "free"

    sessions = PgSessionRepository(conn)
    now = conn.execute("select now() as now").fetchone()
    assert now is not None
    sessions.create(first.id, "session-hash", now["now"] + timedelta(days=30), "ua", "203.0.113.1")
    active = sessions.find_active("session-hash")
    assert active is not None and active.user.email == "db@example.com"
    sessions.touch(active.id)

    sessions.revoke("session-hash")
    assert sessions.find_active("session-hash") is None


def test_選択カテゴリの入れ替えとトリガーの上限(conn: DbConnection) -> None:
    user = PgUserRepository(conn).upsert_on_login("db@example.com")
    repo = PgUserCategoryRepository(conn)

    repo.replace(user.id, ["web3", "ai"])
    assert repo.list_ids(user.id) == ["web3", "ai"]
    repo.replace(user.id, ["security"])
    assert repo.list_ids(user.id) == ["security"]

    with pytest.raises(CategoryLimitExceededError):
        repo.replace(user.id, ["ai", "web3", "startup", "fintech"])
    # 失敗した入れ替えはロールバックされ、元の選択が残る
    assert repo.list_ids(user.id) == ["security"]

    with pytest.raises(UnknownCategoryError):
        repo.replace(user.id, ["unknown"])
