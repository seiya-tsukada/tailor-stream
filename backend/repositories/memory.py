"""メモリ上のストア（DATABASE_URL が無いときのフェイルオーバー。NEWS_PROVIDER=mock のときだけ使う）

- repositories の Protocol をすべて満たす。データはプロセス内にだけ持ち、再起動や別インスタンスでは消える
- 記事はモックプロバイダの記事を取り込んで入れる（MEMORY_STORE_RESEED_MINUTES ごとに入れ直す）
- ユーザーデータもここに入るが、サーバーレス（Vercel）ではインスタンスをまたいで共有されない
"""

import threading
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from backend.config import FEED_MAX_CATEGORIES, MEMORY_STORE_RESEED_MINUTES
from backend.feed.categories import SEED_CATEGORIES, Category
from backend.repositories.articles import ArticleUpsert, FeedArticle
from backend.repositories.ingestion_runs import FinishedStatus
from backend.repositories.sessions import ActiveSession
from backend.repositories.user_categories import CategoryLimitExceededError, UnknownCategoryError
from backend.repositories.users import User

Clock = Callable[[], datetime]


def _utc_now() -> datetime:
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
    def __init__(self, clock: Clock) -> None:
        self._clock = clock
        self._articles: dict[str, ArticleUpsert] = {}
        self._categories: dict[str, set[str]] = {}

    def list_feed(self, category_ids: list[str], limit: int) -> list[FeedArticle]:
        now = self._clock()
        wanted = set(category_ids)
        rows = [
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
                category_ids=sorted(self._categories.get(a.id, set()) & wanted),
            )
            for a in self._articles.values()
            if a.expires_at > now and self._categories.get(a.id, set()) & wanted
        ]
        rows.sort(key=lambda r: r.id)
        rows.sort(key=lambda r: (r.popularity_score, r.published_at), reverse=True)
        return rows[:limit]

    def upsert_for_category(self, category_id: str, articles: list[ArticleUpsert]) -> None:
        for article in articles:
            self._articles[article.id] = article
            self._categories.setdefault(article.id, set()).add(category_id)


class MemoryIngestionRunRepository:
    def __init__(self) -> None:
        self._next_id = 1

    def start(self, provider: str, category_id: str) -> int:
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
    consumed: bool = False


class MemoryLoginTokenRepository:
    def __init__(self, clock: Clock) -> None:
        self._clock = clock
        self._tokens: list[_LoginToken] = []

    def count_recent_by_email(self, email: str, since: datetime) -> int:
        return sum(1 for t in self._tokens if t.email == email and t.created_at >= since)

    def count_recent_by_ip(self, ip: str, since: datetime) -> int:
        return sum(1 for t in self._tokens if t.ip == ip and t.created_at >= since)

    def create(self, email: str, token_hash: str, expires_at: datetime, ip: str | None) -> None:
        self._tokens.append(_LoginToken(email, token_hash, self._clock(), expires_at, ip))

    def consume(self, token_hash: str) -> str | None:
        for token in self._tokens:
            if (
                token.token_hash == token_hash
                and not token.consumed
                and token.expires_at > self._clock()
            ):
                token.consumed = True
                return token.email
        return None


class MemoryUserRepository:
    def __init__(self) -> None:
        self.users: dict[str, User] = {}

    def upsert_on_login(self, email: str) -> User:
        return self.users.setdefault(
            email,
            User(id=uuid4(), email=email, display_name=None, plan="free", plan_expires_at=None),
        )


@dataclass
class _Session:
    session: ActiveSession
    token_hash: str
    expires_at: datetime
    revoked: bool = False


class MemorySessionRepository:
    def __init__(self, clock: Clock, users: MemoryUserRepository) -> None:
        self._clock = clock
        self._users = users
        self._sessions: list[_Session] = []

    def create(
        self,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip: str | None,
    ) -> None:
        user = next(u for u in self._users.users.values() if u.id == user_id)
        session = ActiveSession(id=uuid4(), last_seen_at=self._clock(), user=user)
        self._sessions.append(_Session(session, token_hash, expires_at))

    def find_active(self, token_hash: str) -> ActiveSession | None:
        for s in self._sessions:
            if s.token_hash == token_hash and not s.revoked and s.expires_at > self._clock():
                return s.session
        return None

    def touch(self, session_id: UUID) -> None:
        for s in self._sessions:
            if s.session.id == session_id:
                s.session = replace(s.session, last_seen_at=self._clock())

    def revoke(self, token_hash: str) -> None:
        for s in self._sessions:
            if s.token_hash == token_hash:
                s.revoked = True


class MemoryUserCategoryRepository:
    """DB の制約（最大件数・存在するカテゴリのみ）を再現する"""

    def __init__(self, known_ids: set[str]) -> None:
        self._known_ids = known_ids
        self._selected: dict[UUID, list[str]] = {}

    def list_ids(self, user_id: UUID) -> list[str]:
        return list(self._selected.get(user_id, []))

    def replace(self, user_id: UUID, category_ids: list[str]) -> None:
        if any(c not in self._known_ids for c in category_ids):
            raise UnknownCategoryError
        if len(category_ids) > FEED_MAX_CATEGORIES:
            raise CategoryLimitExceededError
        self._selected[user_id] = list(category_ids)


@dataclass
class MemoryStore:
    clock: Clock = _utc_now
    categories: MemoryCategoryRepository = field(default_factory=MemoryCategoryRepository)
    runs: MemoryIngestionRunRepository = field(default_factory=MemoryIngestionRunRepository)
    users: MemoryUserRepository = field(default_factory=MemoryUserRepository)
    lock: threading.Lock = field(default_factory=threading.Lock)
    seeded_at: datetime | None = None

    def __post_init__(self) -> None:
        self.articles = MemoryArticleRepository(self.clock)
        self.login_tokens = MemoryLoginTokenRepository(self.clock)
        self.sessions = MemorySessionRepository(self.clock, self.users)
        self.user_categories = MemoryUserCategoryRepository(
            {c.id for c in self.categories.list_active()}
        )

    def needs_seed(self) -> bool:
        return self.seeded_at is None or self.clock() - self.seeded_at >= timedelta(
            minutes=MEMORY_STORE_RESEED_MINUTES
        )


_store: MemoryStore | None = None
_store_lock = threading.Lock()


def get_memory_store() -> MemoryStore:
    """プロセスで1つのストア"""
    global _store
    with _store_lock:
        if _store is None:
            _store = MemoryStore()
        return _store
