from datetime import timedelta

import pytest

from backend.feed.categories import SEED_CATEGORIES
from backend.feed.mock_provider import MockNewsProvider
from backend.ingestion.service import IngestionService, normalize_article
from tests.fakes import (
    FIXED_NOW,
    FakeArticleRepository,
    FakeIngestionRunRepository,
    FakeNewsProvider,
    fetched,
)

TTL = timedelta(hours=48)
AI, WEB3, STARTUP = SEED_CATEGORIES[0], SEED_CATEGORIES[1], SEED_CATEGORIES[2]


def make_service(
    provider: FakeNewsProvider | MockNewsProvider,
    articles: FakeArticleRepository,
    runs: FakeIngestionRunRepository,
) -> IngestionService:
    return IngestionService(provider, articles, runs, article_ttl=TTL, now=lambda: FIXED_NOW)


class TestNormalizeArticle:
    def test_転送URLを元のURLに戻して正規化しIDとドメインを決める(self) -> None:
        article = normalize_article(
            fetched(
                "https://www.google.com/url?rct=j&sa=t&url=https://www.Example.com/a/?utm_source=x",
                title="<b>AI</b> &amp; 規制",
                snippet="概要<br>です",
                share_count=10,
            ),
            "fake",
            TTL,
            FIXED_NOW,
        )
        assert article is not None
        assert article.canonical_url == "https://www.example.com/a"
        assert len(article.id) == 32
        assert article.source_domain == "example.com"
        assert article.title == "AI & 規制"
        assert article.snippet == "概要 です"
        assert article.expires_at == article.published_at + TTL
        assert article.popularity_score > 0

    def test_タイトルが空なら既定のタイトルを使い空の概要はNoneにする(self) -> None:
        article = normalize_article(
            fetched("https://example.com/a", title="", snippet="<p></p>"), "fake", TTL, FIXED_NOW
        )
        assert article is not None
        assert article.title == "無題の記事"
        assert article.snippet is None

    def test_httpでないURLは取り込まない(self) -> None:
        assert normalize_article(fetched("javascript:alert(1)"), "fake", TTL, FIXED_NOW) is None

    def test_掲載期限を過ぎた記事は取り込まない(self) -> None:
        old = fetched("https://example.com/a", hours_ago=49)
        assert normalize_article(old, "fake", TTL, FIXED_NOW) is None

    def test_未来日付の記事は取得時刻に揃える(self) -> None:
        future = fetched("https://example.com/a", hours_ago=-5)
        article = normalize_article(future, "fake", TTL, FIXED_NOW)
        assert article is not None
        assert article.published_at == FIXED_NOW

    def test_シェア数が多いほどスコアが高い(self) -> None:
        many = normalize_article(fetched("https://e.com/1", share_count=100), "f", TTL, FIXED_NOW)
        few = normalize_article(fetched("https://e.com/2", share_count=1), "f", TTL, FIXED_NOW)
        none = normalize_article(fetched("https://e.com/3"), "f", TTL, FIXED_NOW)
        assert many and few and none
        assert many.popularity_score > few.popularity_score > none.popularity_score == 0


class TestIngestionService:
    @pytest.fixture
    def articles(self) -> FakeArticleRepository:
        return FakeArticleRepository()

    @pytest.fixture
    def runs(self) -> FakeIngestionRunRepository:
        return FakeIngestionRunRepository()

    def test_取得した記事をupsertし実行記録を成功で閉じる(
        self, articles: FakeArticleRepository, runs: FakeIngestionRunRepository
    ) -> None:
        provider = FakeNewsProvider(
            articles={
                "ai": [
                    fetched("https://example.com/1"),
                    # 同じ記事（トラッキングパラメータ違い）は1件にまとめる
                    fetched("https://example.com/1?utm_source=x"),
                    fetched("https://example.com/2"),
                    fetched("not a url"),
                ]
            }
        )
        [outcome] = make_service(provider, articles, runs).ingest([AI])

        assert outcome.status == "succeeded"
        assert outcome.fetched_count == 4
        assert outcome.stored_count == 2
        assert [a.canonical_url for a in articles.upserts["ai"]] == [
            "https://example.com/1",
            "https://example.com/2",
        ]
        [run] = runs.runs.values()
        assert (run.provider, run.category_id, run.status) == ("fake", "ai", "succeeded")
        assert (run.fetched_count, run.request_units, run.error) == (4, 1, None)

    def test_失敗したカテゴリは記録を失敗で閉じ他のカテゴリは続ける(
        self, articles: FakeArticleRepository, runs: FakeIngestionRunRepository
    ) -> None:
        provider = FakeNewsProvider(
            articles={"web3": [fetched("https://example.com/w")]}, failing={"ai"}
        )
        outcomes = make_service(provider, articles, runs).ingest([AI, WEB3])

        assert [(o.category_id, o.status) for o in outcomes] == [
            ("ai", "failed"),
            ("web3", "succeeded"),
        ]
        failed = runs.runs[1]
        assert failed.status == "failed"
        # 例外メッセージの詳細は記録しない（ログにだけ残す）
        assert failed.error == "RuntimeError"
        assert "ai" not in articles.upserts

    def test_プロバイダが対応しないカテゴリは記録を作らずスキップする(
        self, articles: FakeArticleRepository, runs: FakeIngestionRunRepository
    ) -> None:
        provider = FakeNewsProvider(unsupported={"startup"})
        [outcome] = make_service(provider, articles, runs).ingest([STARTUP])

        assert outcome.status == "skipped"
        assert runs.runs == {}

    def test_モックプロバイダの記事を取り込める(
        self, articles: FakeArticleRepository, runs: FakeIngestionRunRepository
    ) -> None:
        provider = MockNewsProvider(now=lambda: FIXED_NOW)
        [outcome] = make_service(provider, articles, runs).ingest([AI])

        assert outcome.status == "succeeded"
        assert outcome.stored_count == outcome.fetched_count > 0
        stored = articles.upserts["ai"]
        assert all(a.canonical_url.startswith("https://") for a in stored)
        assert all(
            "utm_" not in a.canonical_url and "google.com" not in a.canonical_url for a in stored
        )
        assert all("<b>" not in a.title and "AI" in a.title for a in stored)
