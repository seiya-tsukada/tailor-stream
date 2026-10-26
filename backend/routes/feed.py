from typing import Annotated

from fastapi import APIRouter, Query

from backend.config import FEED_LIMIT, FEED_MAX_CATEGORIES
from backend.errors import AppError, ErrorCode
from backend.models import ArticleOut, FeedResponse
from backend.routes.deps import ArticleRepositoryDep

router = APIRouter(tags=["feed"])


def parse_category_ids(raw: str) -> list[str]:
    """カンマ区切りのカテゴリ ID を、空要素と重複を除いて順序を保ったまま返す"""
    ids = [part.strip() for part in raw.split(",")]
    return list(dict.fromkeys(category_id for category_id in ids if category_id))


# PR 2 でログイン必須にし、カテゴリはユーザー設定（user_categories）から取るように変える
@router.get("/feed", response_model=FeedResponse)
def get_feed(
    articles: ArticleRepositoryDep,
    categories: Annotated[str, Query(description="カンマ区切りのカテゴリ ID（最大3件）")] = "",
) -> FeedResponse:
    category_ids = parse_category_ids(categories)
    if not category_ids:
        raise AppError(422, ErrorCode.CATEGORIES_REQUIRED)
    if len(category_ids) > FEED_MAX_CATEGORIES:
        raise AppError(422, ErrorCode.TOO_MANY_CATEGORIES)

    rows = articles.list_feed(category_ids, FEED_LIMIT)
    return FeedResponse(
        category_ids=category_ids,
        articles=[
            ArticleOut(
                id=row.id,
                url=row.canonical_url,
                title=row.title,
                snippet=row.snippet,
                source_name=row.source_name,
                source_domain=row.source_domain,
                language=row.language,
                image_url=row.image_url,
                published_at=row.published_at,
                popularity_score=row.popularity_score,
                category_ids=row.category_ids,
            )
            for row in rows
        ],
    )
