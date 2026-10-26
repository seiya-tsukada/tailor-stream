import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config import Settings, get_settings
from backend.feed.provider import NewsProvider
from backend.routes import deps
from tests.fakes import (
    FakeArticleRepository,
    FakeCategoryRepository,
    FakeIngestionRunRepository,
    FakeNewsProvider,
)

ADMIN_SECRET = "test-admin-secret-0123456789"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="postgresql://unused@localhost/unused",
        admin_secret=ADMIN_SECRET,
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
def client(
    settings: Settings,
    category_repo: FakeCategoryRepository,
    article_repo: FakeArticleRepository,
    run_repo: FakeIngestionRunRepository,
    news_provider: NewsProvider,
) -> Iterator[TestClient]:
    """repositories・プロバイダをフェイクに差し替えたクライアント（DB には接続しない）"""
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[deps.get_category_repository] = lambda: category_repo
    app.dependency_overrides[deps.get_article_repository] = lambda: article_repo
    app.dependency_overrides[deps.get_ingestion_run_repository] = lambda: run_repo
    app.dependency_overrides[deps.get_news_provider] = lambda: news_provider
    # lifespan（起動時の環境変数チェック）は走らせない
    yield TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL が未設定のため DB テストをスキップ")
    return url
