"""テスト用のフェイク（repositories・NewsProvider の Protocol を満たすインメモリ実装）"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from backend.feed.categories import SEED_CATEGORIES, Category
from backend.feed.provider import FetchedArticle, FetchResult
from backend.repositories.articles import ArticleUpsert, FeedArticle
from backend.repositories.ingestion_runs import FinishedStatus

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
