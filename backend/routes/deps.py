"""ルーターが使う依存関数（テストでは app.dependency_overrides でフェイクに差し替える）"""

import hmac
from collections.abc import Iterator
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Header

from backend.config import ADMIN_AUTH_SCHEME, Settings, get_settings
from backend.db import DbConnection, get_connection
from backend.errors import AppError, ErrorCode
from backend.feed.factory import open_news_provider
from backend.feed.mock_provider import MockNewsProvider
from backend.feed.provider import NewsProvider
from backend.ingestion.service import IngestionService
from backend.repositories.articles import ArticleRepository, PgArticleRepository
from backend.repositories.categories import CategoryRepository, PgCategoryRepository
from backend.repositories.ingestion_runs import IngestionRunRepository, PgIngestionRunRepository
from backend.repositories.login_tokens import LoginTokenRepository, PgLoginTokenRepository
from backend.repositories.memory import MemoryStore, get_memory_store
from backend.repositories.sessions import PgSessionRepository, SessionRepository
from backend.repositories.user_categories import PgUserCategoryRepository, UserCategoryRepository
from backend.repositories.users import PgUserRepository, UserRepository

SettingsDep = Annotated[Settings, Depends(get_settings)]
# DATABASE_URL が無ければ None（このときはメモリ上のストアを使う）
ConnectionDep = Annotated[DbConnection | None, Depends(get_connection)]


def _store(settings: Settings) -> MemoryStore:
    """メモリ上のストア。モック記事が古ければ入れ直す"""
    store = get_memory_store()
    with store.lock:
        if store.needs_seed():
            service = IngestionService(
                MockNewsProvider(store.clock),
                store.articles,
                store.runs,
                article_ttl=timedelta(hours=settings.article_ttl_hours),
                now=store.clock,
            )
            service.ingest(store.categories.list_active())
            store.seeded_at = store.clock()
    return store


def get_category_repository(conn: ConnectionDep, settings: SettingsDep) -> CategoryRepository:
    return PgCategoryRepository(conn) if conn else _store(settings).categories


def get_article_repository(conn: ConnectionDep, settings: SettingsDep) -> ArticleRepository:
    return PgArticleRepository(conn) if conn else _store(settings).articles


def get_ingestion_run_repository(
    conn: ConnectionDep, settings: SettingsDep
) -> IngestionRunRepository:
    return PgIngestionRunRepository(conn) if conn else _store(settings).runs


def get_user_repository(conn: ConnectionDep, settings: SettingsDep) -> UserRepository:
    return PgUserRepository(conn) if conn else _store(settings).users


def get_login_token_repository(conn: ConnectionDep, settings: SettingsDep) -> LoginTokenRepository:
    return PgLoginTokenRepository(conn) if conn else _store(settings).login_tokens


def get_session_repository(conn: ConnectionDep, settings: SettingsDep) -> SessionRepository:
    return PgSessionRepository(conn) if conn else _store(settings).sessions


def get_user_category_repository(
    conn: ConnectionDep, settings: SettingsDep
) -> UserCategoryRepository:
    return PgUserCategoryRepository(conn) if conn else _store(settings).user_categories


def get_news_provider(settings: SettingsDep) -> Iterator[NewsProvider]:
    with open_news_provider(settings) as provider:
        yield provider


def require_admin(
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Authorization: Bearer <ADMIN_SECRET> を定数時間比較で検証する（ADMIN_SECRET が無ければ 503）"""
    if settings.admin_secret is None:
        raise AppError(503, ErrorCode.ADMIN_UNAVAILABLE)
    scheme, _, token = (authorization or "").partition(" ")
    if scheme != ADMIN_AUTH_SCHEME or not hmac.compare_digest(
        token.encode("utf-8"), settings.admin_secret.encode("utf-8")
    ):
        raise AppError(401, ErrorCode.UNAUTHORIZED)


CategoryRepositoryDep = Annotated[CategoryRepository, Depends(get_category_repository)]
ArticleRepositoryDep = Annotated[ArticleRepository, Depends(get_article_repository)]
IngestionRunRepositoryDep = Annotated[IngestionRunRepository, Depends(get_ingestion_run_repository)]
NewsProviderDep = Annotated[NewsProvider, Depends(get_news_provider)]
UserRepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]
LoginTokenRepositoryDep = Annotated[LoginTokenRepository, Depends(get_login_token_repository)]
SessionRepositoryDep = Annotated[SessionRepository, Depends(get_session_repository)]
UserCategoryRepositoryDep = Annotated[UserCategoryRepository, Depends(get_user_category_repository)]
