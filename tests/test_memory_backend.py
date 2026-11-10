"""DATA_BACKEND=memory（DB を使わないモック）と EMAIL_PROVIDER=noop のテスト"""

from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app import create_app
from backend.auth.dependencies import get_email_sender
from backend.config import Settings, get_settings
from backend.email.sender import EmailMessage, NoopEmailSender, create_email_sender
from backend.routes import deps
from tests.conftest import ADMIN_SECRET, APP_BASE_URL
from tests.fakes import FakeEmailSender

PROD_BASE_URL = "https://tailor-stream.example.com"


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "admin_secret": ADMIN_SECRET,
        "app_base_url": APP_BASE_URL,
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


class TestSettings:
    def test_memoryならDATABASE_URLは不要(self) -> None:
        settings = make_settings(data_backend="memory")
        assert settings.database_url is None

    def test_postgresならDATABASE_URLが必須(self) -> None:
        with pytest.raises(ValidationError, match="DATABASE_URL"):
            make_settings(data_backend="postgres")

    def test_空のDATABASE_URLは未設定として扱う(self) -> None:
        with pytest.raises(ValidationError, match="DATABASE_URL"):
            make_settings(data_backend="postgres", database_url="")
        assert make_settings(data_backend="memory", database_url="").database_url is None

    def test_未設定ならDATABASE_URLの有無で決まる(self) -> None:
        assert make_settings().effective_data_backend == "memory"
        assert (
            make_settings(database_url="postgresql://x@localhost/x").effective_data_backend
            == "postgres"
        )

    def test_noopは本番のURLでも使える(self) -> None:
        settings = make_settings(
            data_backend="memory", email_provider="noop", app_base_url=PROD_BASE_URL
        )
        with httpx.Client() as client:
            assert isinstance(create_email_sender(settings, client), NoopEmailSender)

    def test_consoleは本番のURLでは使わない(self) -> None:
        settings = make_settings(
            data_backend="memory", email_provider="console", app_base_url=PROD_BASE_URL
        )
        assert settings.effective_email_provider is None
        with httpx.Client() as client:
            assert create_email_sender(settings, client) is None


def test_noopは宛先もログインリンクもログに出さない(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("INFO")
    NoopEmailSender().send(
        EmailMessage(to="alice@example.com", subject="件名", text="https://x/auth/verify?token=abc")
    )
    assert "alice@example.com" not in caplog.text
    assert "token=abc" not in caplog.text


@pytest.fixture
def email_sender() -> FakeEmailSender:
    return FakeEmailSender()


@pytest.fixture
def memory_client(email_sender: FakeEmailSender) -> Iterator[TestClient]:
    """repositories は差し替えず、DATA_BACKEND=memory の実装をそのまま使う"""
    settings = make_settings(data_backend="memory")
    deps.reset_memory_store()
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    # ログインリンクのトークンを取り出すため、メールだけはフェイクにする
    app.dependency_overrides[get_email_sender] = lambda: email_sender
    yield TestClient(app, raise_server_exceptions=False, headers={"Origin": APP_BASE_URL})
    deps.reset_memory_store()


class TestMemoryBackend:
    def test_healthはDBを確認しない(self, memory_client: TestClient) -> None:
        response = memory_client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["database"] == "skipped"

    def test_カテゴリ一覧を返す(self, memory_client: TestClient) -> None:
        response = memory_client.get("/api/categories")
        assert response.status_code == 200
        assert len(response.json()) > 0

    def test_起動後最初のアクセスでモック記事が入っている(self, memory_client: TestClient) -> None:
        category_id = memory_client.get("/api/categories").json()[0]["id"]
        response = memory_client.get("/api/feed", params={"categories": category_id})
        assert response.status_code == 200
        articles = response.json()["articles"]
        assert len(articles) > 0
        assert all(a["categoryIds"] == [category_id] for a in articles)
        scores = [a["popularityScore"] for a in articles]
        assert scores == sorted(scores, reverse=True)

    def test_管理APIで取り込んでも記事は重複しない(self, memory_client: TestClient) -> None:
        category_id = memory_client.get("/api/categories").json()[0]["id"]
        before = memory_client.get("/api/feed", params={"categories": category_id}).json()
        response = memory_client.post(
            "/api/admin/ingest", headers={"Authorization": f"Bearer {ADMIN_SECRET}"}
        )
        assert response.status_code == 200
        after = memory_client.get("/api/feed", params={"categories": category_id}).json()
        assert len(after["articles"]) == len(before["articles"])

    def test_ログインしてカテゴリを保存できる(
        self, memory_client: TestClient, email_sender: FakeEmailSender
    ) -> None:
        ids = [c["id"] for c in memory_client.get("/api/categories").json()]
        memory_client.post("/api/auth/login-link", json={"email": "alice@example.com"})
        verified = memory_client.post("/api/auth/verify", json={"token": email_sender.last_token()})
        assert verified.status_code == 200

        saved = memory_client.put("/api/me/categories", json={"categoryIds": ids[:2]})
        assert saved.status_code == 200
        assert memory_client.get("/api/me/categories").json()["categoryIds"] == ids[:2]

        too_many = memory_client.put("/api/me/categories", json={"categoryIds": ids[:4]})
        assert too_many.status_code == 422
        unknown = memory_client.put("/api/me/categories", json={"categoryIds": ["nope"]})
        assert unknown.status_code == 422

    def test_未ログインのmeは401(self, memory_client: TestClient) -> None:
        assert memory_client.get("/api/me").status_code == 401
