"""DB を使わないインメモリの repositories（DATA_BACKEND=memory）

Supabase をまだ用意していない段階で、Vercel などにデプロイして画面と API を確認するためのモック。
データはプロセスのメモリにだけ置くので、再起動やサーバーレスのインスタンスをまたいで残らない
（ログイン・カテゴリ保存は同じインスタンスに当たっている間だけ有効）。
Postgres 実装（Pg*Repository）と同じ Protocol を満たし、並び順・上限などの振る舞いも揃える。
"""

import threading
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from uuid import UUID, uuid4

from backend.config import FEED_MAX_CATEGORIES
from backend.feed.categories import SEED_CATEGORIES, Category
from backend.repositories.articles import ArticleUpsert, FeedArticle
from backend.repositories.ingestion_runs import FinishedStatus
from backend.repositories.sessions import ActiveSession
from backend.repositories.user_categories import (
    CategoryLimitExceededError,
    UnknownCategoryError,
)
from backend.repositories.users import User

Clock = Callable[[], datetime]


def _utcnow() -> datetime:
    return datetime.now(UTC)


class MemoryCategoryRepository:
    def __init__(self, categories: tuple[Category, ...] = SEED_CATEGORIES) -> None:
        self._categories = categories

    def list_active(self) -> list[Category]:
        return sorted(
            (c for c in self._categories if c.is_active), key=lambda c: (c.sort_order, c.id)
        )

    def get_active(self, category_id: str) -> Category | None:
        return next((c for c in self.list_active() if c.id == category_id), None)


class MemoryArticleRepository:
    def __init__(self, lock: threading.Lock, clock: Clock = _utcnow) -> None:
        self._lock = lock
        self._clock = clock
        self._articles: dict[str, ArticleUpsert] = {}
        self._categories: dict[str, set[str]] = {}

    def list_feed(self, category_ids: list[str], limit: int) -> list[FeedArticle]:
        """PgArticleRepository.list_feed と同じ並び順（スコア降順 → 公開日時降順 → id）"""
        wanted = set(category_ids)
        now = self._clock()
        with self._lock:
            matched = [
                (article, sorted(self._categories.get(article.id, set()) & wanted))
                for article in self._articles.values()
                if article.expires_at > now and self._categories.get(article.id, set()) & wanted
            ]

        # 取り込みはまだ cluster_id を付けない（ArticleUpsert に無い）ので、記事1件 = 1ストーリー
        ordered = sorted(
            matched,
            key=lambda item: (
                -item[0].popularity_score,
                -item[0].published_at.timestamp(),
                item[0].id,
            ),
        )
        return [
            FeedArticle(
                id=a.id,
                canonical_url=a.canonical_url,
                title=a.title,
                snippet=a.snippet,
                source_name=a.source_name,
                source_domain=a.source_domain,
                language=a.language,
                image_url=a.image_url,
                published_at=a.published_at,
                popularity_score=a.popularity_score,
                cluster_id=None,
                category_ids=cats,
            )
            for a, cats in ordered[:limit]
        ]

    def upsert_for_category(self, category_id: str, articles: list[ArticleUpsert]) -> None:
        with self._lock:
            for article in articles:
                existing = self._articles.get(article.id)
                if existing is None:
                    self._articles[article.id] = article
                else:
                    # Postgres の on conflict と同じく、取れなかった値は前の値を残す。掲載期限は変えない
                    self._articles[article.id] = replace(
                        article,
                        source_name=article.source_name or existing.source_name,
                        image_url=article.image_url or existing.image_url,
                        share_count=(
                            article.share_count
                            if article.share_count is not None
                            else existing.share_count
                        ),
                        expires_at=existing.expires_at,
                    )
                self._categories.setdefault(article.id, set()).add(category_id)


class MemoryIngestionRunRepository:
    def __init__(self, lock: threading.Lock) -> None:
        self._lock = lock
        self._next_id = 1

    def start(self, provider: str, category_id: str) -> int:
        # 実行履歴は保存しない（id だけ払い出す）
        with self._lock:
            run_id = self._next_id
            self._next_id += 1
        return run_id

    def finish(
        self,
        run_id: int,
        status: FinishedStatus,
        fetched_count: int | None,
        request_units: int | None,
        error: str | None,
    ) -> None:
        return None


@dataclass
class _LoginToken:
    email: str
    token_hash: str
    created_at: datetime
    expires_at: datetime
    ip: str | None
    consumed_at: datetime | None = None


class MemoryLoginTokenRepository:
    def __init__(self, lock: threading.Lock, clock: Clock = _utcnow) -> None:
        self._lock = lock
        self._clock = clock
        self._tokens: list[_LoginToken] = []

    def count_recent_by_email(self, email: str, since: datetime) -> int:
        with self._lock:
            return sum(1 for t in self._tokens if t.email == email and t.created_at >= since)

    def count_recent_by_ip(self, ip: str, since: datetime) -> int:
        with self._lock:
            return sum(1 for t in self._tokens if t.ip == ip and t.created_at >= since)

    def create(self, email: str, token_hash: str, expires_at: datetime, ip: str | None) -> None:
        with self._lock:
            now = self._clock()
            # 期限切れのトークンは捨てる（メモリを増やし続けない）
            self._tokens = [t for t in self._tokens if t.expires_at > now]
            self._tokens.append(_LoginToken(email, token_hash, now, expires_at, ip))

    def consume(self, token_hash: str) -> str | None:
        with self._lock:
            now = self._clock()
            for token in self._tokens:
                if token.token_hash == token_hash and token.consumed_at is None:
                    if token.expires_at <= now:
                        return None
                    token.consumed_at = now
                    return token.email
        return None


class MemoryUserRepository:
    def __init__(self, lock: threading.Lock) -> None:
        self._lock = lock
        self._by_email: dict[str, User] = {}

    def upsert_on_login(self, email: str) -> User:
        with self._lock:
            user = self._by_email.get(email)
            if user is None:
                user = User(
                    id=uuid4(), email=email, display_name=None, plan="free", plan_expires_at=None
                )
                self._by_email[email] = user
            return user

    def get(self, user_id: UUID) -> User | None:
        with self._lock:
            return next((u for u in self._by_email.values() if u.id == user_id), None)


@dataclass
class _Session:
    id: UUID
    user_id: UUID
    token_hash: str
    expires_at: datetime
    last_seen_at: datetime
    revoked: bool = False


class MemorySessionRepository:
    def __init__(
        self, lock: threading.Lock, users: MemoryUserRepository, clock: Clock = _utcnow
    ) -> None:
        self._lock = lock
        self._users = users
        self._clock = clock
        self._sessions: dict[str, _Session] = {}

    def create(
        self,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip: str | None,
    ) -> None:
        # user_agent・ip は保存しない（モックなので使い道がない）
        with self._lock:
            self._sessions[token_hash] = _Session(
                uuid4(), user_id, token_hash, expires_at, self._clock()
            )

    def find_active(self, token_hash: str) -> ActiveSession | None:
        with self._lock:
            session = self._sessions.get(token_hash)
            if session is None or session.revoked or session.expires_at <= self._clock():
                return None
            last_seen_at = session.last_seen_at
            session_id, user_id = session.id, session.user_id
        user = self._users.get(user_id)
        if user is None:
            return None
        return ActiveSession(id=session_id, last_seen_at=last_seen_at, user=user)

    def touch(self, session_id: UUID) -> None:
        with self._lock:
            for session in self._sessions.values():
                if session.id == session_id:
                    session.last_seen_at = self._clock()

    def revoke(self, token_hash: str) -> None:
        with self._lock:
            session = self._sessions.get(token_hash)
            if session is not None:
                session.revoked = True


class MemoryUserCategoryRepository:
    """DB の外部キー（存在するカテゴリのみ）とトリガー（最大件数）を再現する"""

    def __init__(self, lock: threading.Lock, categories: MemoryCategoryRepository) -> None:
        self._lock = lock
        self._categories = categories
        self._selected: dict[UUID, list[str]] = {}

    def list_ids(self, user_id: UUID) -> list[str]:
        active = {c.id for c in self._categories.list_active()}
        with self._lock:
            return [c for c in self._selected.get(user_id, []) if c in active]

    def replace(self, user_id: UUID, category_ids: list[str]) -> None:
        if any(self._categories.get_active(c) is None for c in category_ids):
            raise UnknownCategoryError
        if len(category_ids) > FEED_MAX_CATEGORIES:
            raise CategoryLimitExceededError
        with self._lock:
            self._selected[user_id] = list(category_ids)


@dataclass
class MemoryStore:
    """インメモリの repositories 一式（プロセスに1つ）"""

    lock: threading.Lock = field(default_factory=threading.Lock)
    categories: MemoryCategoryRepository = field(default_factory=MemoryCategoryRepository)
    articles: MemoryArticleRepository = field(init=False)
    ingestion_runs: MemoryIngestionRunRepository = field(init=False)
    login_tokens: MemoryLoginTokenRepository = field(init=False)
    users: MemoryUserRepository = field(init=False)
    sessions: MemorySessionRepository = field(init=False)
    user_categories: MemoryUserCategoryRepository = field(init=False)

    def __post_init__(self) -> None:
        self.articles = MemoryArticleRepository(self.lock)
        self.ingestion_runs = MemoryIngestionRunRepository(self.lock)
        self.login_tokens = MemoryLoginTokenRepository(self.lock)
        self.users = MemoryUserRepository(self.lock)
        self.sessions = MemorySessionRepository(self.lock, self.users)
        self.user_categories = MemoryUserCategoryRepository(self.lock, self.categories)
