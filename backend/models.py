"""API の入出力モデル（JSON はキャメルケース）"""

from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from backend.config import EMAIL_MAX_LENGTH, FEED_MAX_CATEGORIES
from backend.errors import ErrorCode
from backend.repositories.users import Plan, User

# トークン（token_urlsafe(32) は 43 文字）の入力上限。異常に長い値は検証前に弾く
TOKEN_MAX_LENGTH = 256
CATEGORY_ID_MAX_LENGTH = 64


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


class LoginLinkRequest(CamelModel):
    email: str = Field(max_length=EMAIL_MAX_LENGTH * 2)


class VerifyRequest(CamelModel):
    token: str = Field(max_length=TOKEN_MAX_LENGTH)


class MeResponse(CamelModel):
    id: UUID
    email: str
    display_name: str | None
    plan: Plan
    plan_expires_at: datetime | None

    @classmethod
    def from_user(cls, user: User) -> Self:
        return cls(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            plan=user.plan,
            plan_expires_at=user.plan_expires_at,
        )


class UserCategoriesResponse(CamelModel):
    category_ids: list[str]


class UserCategoriesRequest(CamelModel):
    # 上限超過は 422 TOO_MANY_CATEGORIES で返すため、ここでは件数を緩めに制限するだけにする
    category_ids: list[str] = Field(max_length=FEED_MAX_CATEGORIES * 4)


class ErrorBody(CamelModel):
    code: ErrorCode
    message: str


class ErrorResponse(CamelModel):
    error: ErrorBody
