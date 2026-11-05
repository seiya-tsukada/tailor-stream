"""環境変数が足りないときのフェイルオーバー（APP_BASE_URL・メール送信・DB・ADMIN_SECRET）"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.auth.dependencies import get_email_sender
from backend.config import DEFAULT_APP_BASE_URL, Settings, SettingsError, get_settings
from backend.repositories import memory
from tests.fakes import FakeEmailSender

ENV_NAMES = (
    "DATABASE_URL",
    "ADMIN_SECRET",
    "APP_BASE_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "NEWS_PROVIDER",
    "EMAIL_PROVIDER",
    "RESEND_API_KEY",
    "EMAIL_FROM",
)
PROD_HOST = "tailor-stream.vercel.app"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    """リポジトリの .env や実行環境の変数を読ませない"""
    for name in ENV_NAMES:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def make_settings(**values: str) -> Settings:
    return Settings(_env_file=None, **values)  # type: ignore[call-arg, arg-type]


class TestSettings:
    def test_mockなら環境変数が無くても起動できる(self) -> None:
        settings = get_settings()
        assert settings.news_provider == "mock"
        assert settings.uses_memory_store
        assert settings.admin_secret is None
        assert settings.app_base_url == DEFAULT_APP_BASE_URL
        # ローカルなので console にフェイルオーバーする
        assert settings.effective_email_provider == "console"

    def test_空文字は未設定として扱う(self) -> None:
        settings = make_settings(database_url="", admin_secret="", email_provider="")
        assert settings.database_url is None
        assert settings.admin_secret is None
        assert settings.email_provider is None

    def test_mock以外ではDATABASE_URLとADMIN_SECRETが必須(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("NEWS_PROVIDER", "google_alerts_rss")
        with pytest.raises(SettingsError, match="DATABASE_URL, ADMIN_SECRET"):
            get_settings()

    def test_APP_BASE_URLが無ければVercelの本番URLを使う(self) -> None:
        settings = make_settings(vercel_project_production_url=PROD_HOST)
        assert settings.app_base_url == f"https://{PROD_HOST}"
        assert settings.cookie_secure

    def test_APP_BASE_URLが優先されパスは落とす(self) -> None:
        settings = make_settings(
            app_base_url="https://example.com/some/path", vercel_project_production_url=PROD_HOST
        )
        assert settings.app_base_url == "https://example.com"

    def test_本番でメール設定が無ければログイン機能は無効(self) -> None:
        settings = make_settings(vercel_project_production_url=PROD_HOST)
        assert settings.effective_email_provider is None

    def test_本番ではconsoleを指定しても使わない(self) -> None:
        settings = make_settings(vercel_project_production_url=PROD_HOST, email_provider="console")
        assert settings.effective_email_provider is None

    def test_RESENDの設定がそろっていれば自動でresendを使う(self) -> None:
        settings = make_settings(
            vercel_project_production_url=PROD_HOST,
            resend_api_key="re_test",
            email_from="TailorStream <login@example.com>",
        )
        assert settings.effective_email_provider == "resend"

    def test_resend指定でキーが無ければ無効(self) -> None:
        settings = make_settings(email_provider="resend")
        assert settings.effective_email_provider is None


@pytest.fixture
def fresh_store(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(memory, "_store", None)


def memory_client(settings: Settings, email_sender: FakeEmailSender | None = None) -> TestClient:
    """DB を使わない（メモリ上のストアで動く）クライアント"""
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    if email_sender is not None:
        app.dependency_overrides[get_email_sender] = lambda: email_sender
    return TestClient(app, raise_server_exceptions=False, headers={"Origin": settings.app_base_url})


@pytest.mark.usefixtures("fresh_store")
class TestMemoryStore:
    def test_カテゴリとモック記事を返す(self) -> None:
        client = memory_client(make_settings())
        categories = client.get("/api/categories")
        assert categories.status_code == 200
        assert len(categories.json()) == 8

        feed = client.get("/api/feed", params={"categories": "ai,web3"})
        assert feed.status_code == 200
        articles = feed.json()["articles"]
        assert articles
        assert all(set(a["categoryIds"]) <= {"ai", "web3"} for a in articles)
        scores = [a["popularityScore"] for a in articles]
        assert scores == sorted(scores, reverse=True)

    def test_ADMIN_SECRETが無ければ管理APIは503(self) -> None:
        client = memory_client(make_settings())
        response = client.post("/api/admin/ingest", headers={"Authorization": "Bearer x"})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "ADMIN_UNAVAILABLE"

    def test_メール送信が無ければログインリンクは503で他のAPIは動く(self) -> None:
        client = memory_client(make_settings(vercel_project_production_url=PROD_HOST))
        response = client.post("/api/auth/login-link", json={"email": "a@example.com"})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "LOGIN_UNAVAILABLE"
        assert client.get("/api/me").status_code == 401
        assert client.get("/api/feed", params={"categories": "ai"}).status_code == 200

    def test_メモリ上でもログインとカテゴリ保存ができる(self) -> None:
        sender = FakeEmailSender()
        client = memory_client(make_settings(), sender)
        assert (
            client.post("/api/auth/login-link", json={"email": "m@example.com"}).status_code == 202
        )
        verify = client.post("/api/auth/verify", json={"token": sender.last_token()})
        assert verify.status_code == 200

        saved = client.put("/api/me/categories", json={"categoryIds": ["ai", "web3"]})
        assert saved.status_code == 200
        assert client.get("/api/me/categories").json() == {"categoryIds": ["ai", "web3"]}
        too_many = client.put("/api/me/categories", json={"categoryIds": ["ai", "web3", "nope"]})
        assert too_many.status_code == 422
