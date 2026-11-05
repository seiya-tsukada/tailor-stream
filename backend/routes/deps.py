"""ルーターが使う依存関数（テストでは app.dependency_overrides でフェイクに差し替える）"""

import hmac
import logging
import threading
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
from backend.repositories.memory import MemoryStore
from backend.repositories.sessions import PgSessionRepository, SessionRepository
from backend.repositories.user_categories import PgUserCategoryRepository, UserCategoryRepository
from backend.repositories.users import PgUserRepository, UserRepository

logger = logging.getLogger(__name__)

SettingsDep = Annotated[Settings, Depends(get_settings)]

_memory_store: MemoryStore | None = None
_memory_store_lock = threading.Lock()


def get_memory_store(settings: Settings) -> MemoryStore:
    """DATA_BACKEND=memory 用のストア（プロセスに1つ）。最初の呼び出しでモック記事を取り込む"""
    global _memory_store
    with _memory_store_lock:
        if _memory_store is None:
            store = MemoryStore()
            IngestionService(
                MockNewsProvider(),
                store.articles,
                store.ingestion_runs,
                article_ttl=timedelta(hours=settings.article_ttl_hours),
            ).ingest(store.categories.list_active())
            logger.info("DATA_BACKEND=memory: インメモリのストアを作成しモック記事を取り込みました")
            _memory_store = store
        return _memory_store


def reset_memory_store() -> None:
    """テスト用: インメモリのストアを捨てる"""
    global _memory_store
    with _memory_store_lock:
        _memory_store = None


def get_optional_connection(settings: SettingsDep) -> Iterator[DbConnection | None]:
    """DATA_BACKEND=postgres ならリクエスト単位の DB 接続、memory なら None（接続しない）"""
    if settings.effective_data_backend == "memory":
        yield None
        return
    yield from get_connection(settings)


ConnectionDep = Annotated[DbConnection | None, Depends(get_optional_connection)]


def get_category_repository(settings: SettingsDep, conn: ConnectionDep) -> CategoryRepository:
    if conn is None:
        return get_memory_store(settings).categories
    return PgCategoryRepository(conn)


def get_article_repository(settings: SettingsDep, conn: ConnectionDep) -> ArticleRepository:
    if conn is None:
        return get_memory_store(settings).articles
    return PgArticleRepository(conn)


def get_ingestion_run_repository(
    settings: SettingsDep, conn: ConnectionDep
) -> IngestionRunRepository:
    if conn is None:
        return get_memory_store(settings).ingestion_runs
    return PgIngestionRunRepository(conn)


def get_user_repository(settings: SettingsDep, conn: ConnectionDep) -> UserRepository:
    if conn is None:
        return get_memory_store(settings).users
    return PgUserRepository(conn)


def get_login_token_repository(settings: SettingsDep, conn: ConnectionDep) -> LoginTokenRepository:
    if conn is None:
        return get_memory_store(settings).login_tokens
    return PgLoginTokenRepository(conn)


def get_session_repository(settings: SettingsDep, conn: ConnectionDep) -> SessionRepository:
    if conn is None:
        return get_memory_store(settings).sessions
    return PgSessionRepository(conn)


def get_user_category_repository(
    settings: SettingsDep, conn: ConnectionDep
) -> UserCategoryRepository:
    if conn is None:
        return get_memory_store(settings).user_categories
    return PgUserCategoryRepository(conn)


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
