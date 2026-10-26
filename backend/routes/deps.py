"""ルーターが使う依存関数（テストでは app.dependency_overrides でフェイクに差し替える）"""

import hmac
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Header

from backend.config import ADMIN_AUTH_SCHEME, Settings, get_settings
from backend.db import DbConnection, get_connection
from backend.errors import AppError, ErrorCode
from backend.feed.factory import open_news_provider
from backend.feed.provider import NewsProvider
from backend.repositories.articles import ArticleRepository, PgArticleRepository
from backend.repositories.categories import CategoryRepository, PgCategoryRepository
from backend.repositories.ingestion_runs import IngestionRunRepository, PgIngestionRunRepository

SettingsDep = Annotated[Settings, Depends(get_settings)]
ConnectionDep = Annotated[DbConnection, Depends(get_connection)]


def get_category_repository(conn: ConnectionDep) -> CategoryRepository:
    return PgCategoryRepository(conn)


def get_article_repository(conn: ConnectionDep) -> ArticleRepository:
    return PgArticleRepository(conn)


def get_ingestion_run_repository(conn: ConnectionDep) -> IngestionRunRepository:
    return PgIngestionRunRepository(conn)


def get_news_provider(settings: SettingsDep) -> Iterator[NewsProvider]:
    with open_news_provider(settings) as provider:
        yield provider


def require_admin(
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Authorization: Bearer <ADMIN_SECRET> を定数時間比較で検証する"""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme != ADMIN_AUTH_SCHEME or not hmac.compare_digest(
        token.encode("utf-8"), settings.admin_secret.encode("utf-8")
    ):
        raise AppError(401, ErrorCode.UNAUTHORIZED)


CategoryRepositoryDep = Annotated[CategoryRepository, Depends(get_category_repository)]
ArticleRepositoryDep = Annotated[ArticleRepository, Depends(get_article_repository)]
IngestionRunRepositoryDep = Annotated[IngestionRunRepository, Depends(get_ingestion_run_repository)]
NewsProviderDep = Annotated[NewsProvider, Depends(get_news_provider)]
