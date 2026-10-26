"""API の入出力モデル（JSON はキャメルケース）"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from backend.errors import ErrorCode


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class HealthResponse(CamelModel):
    status: Literal["ok"]
    timestamp: datetime


class CategoryOut(CamelModel):
    id: str
    name_ja: str
    name_en: str
    description: str | None
    sort_order: int


class ArticleOut(CamelModel):
    id: str
    url: str
    title: str
    snippet: str | None
    source_name: str | None
    source_domain: str
    language: str
    image_url: str | None
    published_at: datetime
    popularity_score: float
    category_ids: list[str]


class FeedResponse(CamelModel):
    category_ids: list[str]
    articles: list[ArticleOut]


class IngestRequest(CamelModel):
    # 省略すると全アクティブカテゴリを取り込む
    category_id: str | None = None


class IngestResultOut(CamelModel):
    category_id: str
    status: Literal["succeeded", "failed", "skipped"]
    fetched_count: int
    stored_count: int


class IngestResponse(CamelModel):
    provider: str
    results: list[IngestResultOut]


class ErrorBody(CamelModel):
    code: ErrorCode
    message: str


class ErrorResponse(CamelModel):
    error: ErrorBody
