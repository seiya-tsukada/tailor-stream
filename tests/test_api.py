"""API のテスト（repositories・プロバイダはフェイク。DB には接続しない）"""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from backend.config import SettingsError, get_settings
from backend.repositories.articles import FeedArticle
from tests.conftest import ADMIN_SECRET
from tests.fakes import (
    FIXED_NOW,
    FakeArticleRepository,
    FakeIngestionRunRepository,
    FakeNewsProvider,
    fetched,
)

ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_SECRET}"}


def feed_article(article_id: str, score: float) -> FeedArticle:
    return FeedArticle(
        id=article_id,
        canonical_url=f"https://example.com/{article_id}",
        title=f"title {article_id}",
        snippet=None,
        source_name="Example",
        source_domain="example.com",
        language="ja",
        image_url=None,
        published_at=FIXED_NOW - timedelta(hours=1),
        popularity_score=score,
        cluster_id=None,
        category_ids=["ai"],
    )


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_categoriesはアクティブなカテゴリをキャメルケースで返す(client: TestClient) -> None:
    response = client.get("/api/categories")
    assert response.status_code == 200
    body = response.json()
    assert body[0] == {
        "id": "ai",
        "nameJa": "AI",
        "nameEn": "AI",
        "description": "生成AI・機械学習・AIエージェントの動向",
        "sortOrder": 10,
    }


class TestFeed:
    def test_選択カテゴリの記事を返す(
        self, client: TestClient, article_repo: FakeArticleRepository
    ) -> None:
        article_repo.feed = [feed_article("a1", 2.0), feed_article("a2", 1.0)]

        response = client.get("/api/feed", params={"categories": " ai, web3 ,ai,"})

        assert response.status_code == 200
        body = response.json()
        assert body["categoryIds"] == ["ai", "web3"]
        assert [a["id"] for a in body["articles"]] == ["a1", "a2"]
        assert body["articles"][0]["url"] == "https://example.com/a1"
        assert body["articles"][0]["sourceDomain"] == "example.com"
        assert article_repo.feed_calls == [(["ai", "web3"], 100)]

    def test_カテゴリが4つ以上なら422(self, client: TestClient) -> None:
        response = client.get("/api/feed", params={"categories": "ai,web3,startup,fintech"})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "TOO_MANY_CATEGORIES"

    def test_カテゴリ未指定なら422(self, client: TestClient) -> None:
        response = client.get("/api/feed")
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "CATEGORIES_REQUIRED"


class TestAdminIngest:
    @pytest.mark.parametrize(
        "headers",
        [
            {},
            {"Authorization": "Bearer wrong-secret"},
            {"Authorization": ADMIN_SECRET},
            {"Authorization": f"Basic {ADMIN_SECRET}"},
        ],
    )
    def test_ADMIN_SECRETが一致しなければ401(
        self, client: TestClient, headers: dict[str, str], run_repo: FakeIngestionRunRepository
    ) -> None:
        response = client.post("/api/admin/ingest", headers=headers)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"
        assert run_repo.runs == {}

    def test_categoryIdを省略すると全アクティブカテゴリを取り込む(
        self,
        client: TestClient,
        news_provider: FakeNewsProvider,
        article_repo: FakeArticleRepository,
    ) -> None:
        news_provider.articles["ai"] = [fetched("https://example.com/1")]

        response = client.post("/api/admin/ingest", headers=ADMIN_HEADERS)

        assert response.status_code == 200
        body = response.json()
        assert body["provider"] == "fake"
        assert len(body["results"]) == 8
        assert body["results"][0] == {
            "categoryId": "ai",
            "status": "succeeded",
            "fetchedCount": 1,
            "storedCount": 1,
        }
        assert list(article_repo.upserts) == ["ai"]

    def test_categoryIdを指定するとそのカテゴリだけ取り込む(
        self, client: TestClient, run_repo: FakeIngestionRunRepository
    ) -> None:
        response = client.post(
            "/api/admin/ingest", headers=ADMIN_HEADERS, json={"categoryId": "web3"}
        )
        assert response.status_code == 200
        assert [r["categoryId"] for r in response.json()["results"]] == ["web3"]
        assert [run.category_id for run in run_repo.runs.values()] == ["web3"]

    def test_存在しないカテゴリは404(self, client: TestClient) -> None:
        response = client.post(
            "/api/admin/ingest", headers=ADMIN_HEADERS, json={"categoryId": "unknown"}
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "CATEGORY_NOT_FOUND"

    def test_取り込みの失敗は詳細を返さない(
        self, client: TestClient, news_provider: FakeNewsProvider
    ) -> None:
        news_provider.failing.add("ai")
        response = client.post(
            "/api/admin/ingest", headers=ADMIN_HEADERS, json={"categoryId": "ai"}
        )
        assert response.status_code == 200
        assert response.json()["results"][0]["status"] == "failed"
        assert "secret detail" not in response.text


class TestErrors:
    def test_未知のパスは固定のエラーを返す(self, client: TestClient) -> None:
        response = client.get("/api/unknown")
        assert response.status_code == 404
        assert response.json() == {"error": {"code": "NOT_FOUND", "message": "見つかりません"}}

    def test_予期しない例外は詳細を隠して500(
        self, client: TestClient, article_repo: FakeArticleRepository
    ) -> None:
        def boom(_ids: list[str], _limit: int) -> list[FeedArticle]:
            raise RuntimeError("password=hunter2")

        article_repo.list_feed = boom  # type: ignore[method-assign]
        response = client.get("/api/feed", params={"categories": "ai"})
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "hunter2" not in response.text

    def test_環境変数が不足していれば503で変数名だけをログに出す(
        self, client: TestClient, caplog: pytest.LogCaptureFixture
    ) -> None:
        def missing() -> None:
            raise SettingsError("環境変数が未設定または不正です: DATABASE_URL")

        client.app.dependency_overrides[get_settings] = missing  # type: ignore[attr-defined]
        response = client.post("/api/admin/ingest", headers=ADMIN_HEADERS)
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
        assert "DATABASE_URL" in caplog.text


def test_必須の環境変数が無ければSettingsErrorに変数名が出る(
    monkeypatch: pytest.MonkeyPatch, tmp_path: object
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("ADMIN_SECRET", raising=False)
    monkeypatch.chdir(tmp_path)  # type: ignore[arg-type]  # リポジトリの .env を読ませない
    get_settings.cache_clear()
    try:
        with pytest.raises(SettingsError, match="ADMIN_SECRET, DATABASE_URL"):
            get_settings()
    finally:
        get_settings.cache_clear()
