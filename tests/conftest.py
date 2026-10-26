import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.auth.dependencies import get_email_sender
from backend.config import Settings, get_settings
from backend.feed.provider import NewsProvider
from backend.routes import deps
from tests.fakes import (
    FakeArticleRepository,
    FakeCategoryRepository,
    FakeClock,
    FakeEmailSender,
    FakeIngestionRunRepository,
    FakeLoginTokenRepository,
    FakeNewsProvider,
    FakeSessionRepository,
    FakeUserCategoryRepository,
    FakeUserRepository,
)

ADMIN_SECRET = "test-admin-secret-0123456789"
APP_BASE_URL = "http://localhost:5173"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="postgresql://unused@localhost/unused",
        admin_secret=ADMIN_SECRET,
        app_base_url=APP_BASE_URL,
        _env_file=None,  # type: ignore[call-arg]
    )


@pytest.fixture
def category_repo() -> FakeCategoryRepository:
    return FakeCategoryRepository()


@pytest.fixture
def article_repo() -> FakeArticleRepository:
    return FakeArticleRepository()


@pytest.fixture
def run_repo() -> FakeIngestionRunRepository:
    return FakeIngestionRunRepository()


@pytest.fixture
def news_provider() -> NewsProvider:
    return FakeNewsProvider()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def user_repo() -> FakeUserRepository:
    return FakeUserRepository()


@pytest.fixture
def login_token_repo(clock: FakeClock) -> FakeLoginTokenRepository:
    return FakeLoginTokenRepository(clock)


@pytest.fixture
def session_repo(clock: FakeClock, user_repo: FakeUserRepository) -> FakeSessionRepository:
    return FakeSessionRepository(clock, user_repo)


@pytest.fixture
def user_category_repo() -> FakeUserCategoryRepository:
    return FakeUserCategoryRepository()


@pytest.fixture
def email_sender() -> FakeEmailSender:
    return FakeEmailSender()


@pytest.fixture
def client(
    settings: Settings,
    category_repo: FakeCategoryRepository,
    article_repo: FakeArticleRepository,
    run_repo: FakeIngestionRunRepository,
    news_provider: NewsProvider,
    user_repo: FakeUserRepository,
    login_token_repo: FakeLoginTokenRepository,
    session_repo: FakeSessionRepository,
    user_category_repo: FakeUserCategoryRepository,
    email_sender: FakeEmailSender,
) -> Iterator[TestClient]:
    """repositories・プロバイダ・メール送信をフェイクに差し替えたクライアント（DB には接続しない）

    ブラウザと同じく Origin に APP_BASE_URL を付けて送る。
    """
    app = create_app()
    overrides = {
        get_settings: lambda: settings,
        deps.get_category_repository: lambda: category_repo,
        deps.get_article_repository: lambda: article_repo,
        deps.get_ingestion_run_repository: lambda: run_repo,
        deps.get_news_provider: lambda: news_provider,
        deps.get_user_repository: lambda: user_repo,
        deps.get_login_token_repository: lambda: login_token_repo,
        deps.get_session_repository: lambda: session_repo,
        deps.get_user_category_repository: lambda: user_category_repo,
        get_email_sender: lambda: email_sender,
    }
    app.dependency_overrides.update(overrides)
    # lifespan（起動時の環境変数チェック）は走らせない
    yield TestClient(app, raise_server_exceptions=False, headers={"Origin": APP_BASE_URL})


@pytest.fixture
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL が未設定のため DB テストをスキップ")
    return url
