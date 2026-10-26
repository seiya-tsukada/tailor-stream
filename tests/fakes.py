"""テスト用のフェイク（repositories・NewsProvider の Protocol を満たすインメモリ実装）"""

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from backend.email.sender import EmailMessage
from backend.feed.categories import SEED_CATEGORIES, Category
from backend.feed.provider import FetchedArticle, FetchResult
from backend.repositories.articles import ArticleUpsert, FeedArticle
from backend.repositories.ingestion_runs import FinishedStatus
from backend.repositories.sessions import ActiveSession
from backend.repositories.user_categories import (
    CategoryLimitExceededError,
    UnknownCategoryError,
)
from backend.repositories.users import User

FIXED_NOW = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


class FakeCategoryRepository:
    def __init__(self, categories: tuple[Category, ...] = SEED_CATEGORIES) -> None:
        self.categories = list(categories)

    def list_active(self) -> list[Category]:
        return sorted(
            (c for c in self.categories if c.is_active), key=lambda c: (c.sort_order, c.id)
        )

    def get_active(self, category_id: str) -> Category | None:
        return next((c for c in self.list_active() if c.id == category_id), None)


class FakeArticleRepository:
    def __init__(self) -> None:
        self.feed: list[FeedArticle] = []
        self.feed_calls: list[tuple[list[str], int]] = []
        self.upserts: dict[str, list[ArticleUpsert]] = {}

    def list_feed(self, category_ids: list[str], limit: int) -> list[FeedArticle]:
        self.feed_calls.append((category_ids, limit))
        return self.feed[:limit]

    def upsert_for_category(self, category_id: str, articles: list[ArticleUpsert]) -> None:
        if articles:
            self.upserts.setdefault(category_id, []).extend(articles)


@dataclass
class FakeRun:
    provider: str
    category_id: str
    status: str = "running"
    fetched_count: int | None = None
    request_units: int | None = None
    error: str | None = None


class FakeIngestionRunRepository:
    def __init__(self) -> None:
        self.runs: dict[int, FakeRun] = {}

    def start(self, provider: str, category_id: str) -> int:
        run_id = len(self.runs) + 1
        self.runs[run_id] = FakeRun(provider, category_id)
        return run_id

    def finish(
        self,
        run_id: int,
        status: FinishedStatus,
        fetched_count: int | None,
        request_units: int | None,
        error: str | None,
    ) -> None:
        run = self.runs[run_id]
        run.status = status
        run.fetched_count = fetched_count
        run.request_units = request_units
        run.error = error


@dataclass
class FakeNewsProvider:
    articles: dict[str, list[FetchedArticle]] = field(default_factory=dict)
    unsupported: set[str] = field(default_factory=set)
    failing: set[str] = field(default_factory=set)

    @property
    def name(self) -> str:
        return "fake"

    def supports(self, category: Category) -> bool:
        return category.id not in self.unsupported

    def fetch_articles(self, category: Category) -> FetchResult:
        if category.id in self.failing:
            raise RuntimeError("secret detail that must not leak")
        return FetchResult(articles=self.articles.get(category.id, []), request_units=1)


def fetched(
    url: str,
    *,
    title: str = "記事",
    snippet: str | None = None,
    hours_ago: float = 1.0,
    share_count: int | None = None,
) -> FetchedArticle:
    return FetchedArticle(
        url=url,
        title=title,
        snippet=snippet,
        source_name=None,
        published_at=FIXED_NOW - timedelta(hours=hours_ago),
        language="ja",
        share_count=share_count,
    )


# =============================================================
# 認証・ユーザーデータ
# =============================================================


class FakeClock:
    """テストで時刻を進めるための時計（AuthService とフェイクで共有する）"""

    def __init__(self, now: datetime | None = None) -> None:
        self.current = now or datetime.now(UTC)

    def __call__(self) -> datetime:
        return self.current

    def advance(self, **kwargs: float) -> None:
        self.current += timedelta(**kwargs)


@dataclass
class FakeLoginToken:
    email: str
    token_hash: str
    created_at: datetime
    expires_at: datetime
    ip: str | None
    consumed_at: datetime | None = None


class FakeLoginTokenRepository:
    def __init__(self, clock: Callable[[], datetime]) -> None:
        self.clock = clock
        self.tokens: list[FakeLoginToken] = []

    def count_recent_by_email(self, email: str, since: datetime) -> int:
        return sum(1 for t in self.tokens if t.email == email and t.created_at >= since)

    def count_recent_by_ip(self, ip: str, since: datetime) -> int:
        return sum(1 for t in self.tokens if t.ip == ip and t.created_at >= since)

    def create(self, email: str, token_hash: str, expires_at: datetime, ip: str | None) -> None:
        self.tokens.append(FakeLoginToken(email, token_hash, self.clock(), expires_at, ip))

    def consume(self, token_hash: str) -> str | None:
        for token in self.tokens:
            if (
                token.token_hash == token_hash
                and token.consumed_at is None
                and token.expires_at > self.clock()
            ):
                token.consumed_at = self.clock()
                return token.email
        return None


class FakeUserRepository:
    def __init__(self) -> None:
        self.users: dict[str, User] = {}
        self.login_count: dict[str, int] = {}

    def upsert_on_login(self, email: str) -> User:
        user = self.users.setdefault(
            email,
            User(id=uuid4(), email=email, display_name=None, plan="free", plan_expires_at=None),
        )
        self.login_count[email] = self.login_count.get(email, 0) + 1
        return user


@dataclass
class FakeSession:
    id: UUID
    user: User
    token_hash: str
    expires_at: datetime
    last_seen_at: datetime
    user_agent: str | None
    ip: str | None
    revoked: bool = False


class FakeSessionRepository:
    def __init__(self, clock: Callable[[], datetime], users: FakeUserRepository) -> None:
        self.clock = clock
        self.users = users
        self.sessions: list[FakeSession] = []
        self.touched: list[UUID] = []

    def create(
        self,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip: str | None,
    ) -> None:
        user = next(u for u in self.users.users.values() if u.id == user_id)
        self.sessions.append(
            FakeSession(uuid4(), user, token_hash, expires_at, self.clock(), user_agent, ip)
        )

    def find_active(self, token_hash: str) -> ActiveSession | None:
        for s in self.sessions:
            if s.token_hash == token_hash and not s.revoked and s.expires_at > self.clock():
                return ActiveSession(id=s.id, last_seen_at=s.last_seen_at, user=s.user)
        return None

    def touch(self, session_id: UUID) -> None:
        self.touched.append(session_id)
        for s in self.sessions:
            if s.id == session_id:
                s.last_seen_at = self.clock()

    def revoke(self, token_hash: str) -> None:
        for s in self.sessions:
            if s.token_hash == token_hash:
                s.revoked = True


class FakeUserCategoryRepository:
    """DB トリガー（最大3件）と外部キー（存在するカテゴリのみ）を再現する"""

    def __init__(self, known_ids: set[str] | None = None) -> None:
        self.known_ids = known_ids or {c.id for c in SEED_CATEGORIES}
        self.selected: dict[UUID, list[str]] = {}

    def list_ids(self, user_id: UUID) -> list[str]:
        return list(self.selected.get(user_id, []))

    def replace(self, user_id: UUID, category_ids: list[str]) -> None:
        if any(c not in self.known_ids for c in category_ids):
            raise UnknownCategoryError
        if len(category_ids) > 3:
            raise CategoryLimitExceededError
        self.selected[user_id] = list(category_ids)


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> None:
        self.sent.append(message)

    def last_token(self) -> str:
        """最後に送ったメールのログインリンクからトークンを取り出す"""
        match = re.search(r"token=([\w-]+)", self.sent[-1].text)
        assert match is not None
        return match.group(1)
