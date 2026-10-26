from typing import Annotated

from fastapi import APIRouter, Query

from backend.auth.dependencies import OptionalUserDep
from backend.config import FEED_LIMIT, FEED_MAX_CATEGORIES
from backend.errors import AppError, ErrorCode
from backend.models import ArticleOut, FeedResponse
from backend.routes.deps import ArticleRepositoryDep, UserCategoryRepositoryDep

router = APIRouter(tags=["feed"])


def parse_category_ids(raw: str) -> list[str]:
    """カンマ区切りのカテゴリ ID を、空要素と重複を除いて順序を保ったまま返す"""
    ids = [part.strip() for part in raw.split(",")]
    return list(dict.fromkeys(category_id for category_id in ids if category_id))


@router.get("/feed", response_model=FeedResponse)
def get_feed(
    articles: ArticleRepositoryDep,
    user_categories: UserCategoryRepositoryDep,
    user: OptionalUserDep,
    categories: Annotated[
        str,
        Query(
            description="カンマ区切りのカテゴリ ID（最大3件）。ログイン中は無視してユーザー設定を使う"
        ),
    ] = "",
) -> FeedResponse:
    """ログイン中はユーザーの選択カテゴリ、未ログインはクエリのカテゴリの記事を返す"""
    if user is not None:
        category_ids = user_categories.list_ids(user.id)
    else:
        category_ids = parse_category_ids(categories)
        if len(category_ids) > FEED_MAX_CATEGORIES:
            raise AppError(422, ErrorCode.TOO_MANY_CATEGORIES)
    if not category_ids:
        # カテゴリ未選択なら空の一覧（categoryIds が空であることで未選択を伝える）
        return FeedResponse(category_ids=[], articles=[])

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
