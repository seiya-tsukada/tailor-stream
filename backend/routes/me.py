from fastapi import APIRouter

from backend.auth.dependencies import CurrentUserDep
from backend.config import FEED_MAX_CATEGORIES
from backend.errors import AppError, ErrorCode
from backend.models import ErrorResponse, MeResponse, UserCategoriesRequest, UserCategoriesResponse
from backend.repositories.user_categories import CategoryLimitExceededError, UnknownCategoryError
from backend.routes.deps import UserCategoryRepositoryDep
from backend.routes.feed import parse_category_ids

# すべてログイン必須
router = APIRouter(prefix="/me", tags=["me"], responses={401: {"model": ErrorResponse}})


@router.get("", response_model=MeResponse)
def get_me(user: CurrentUserDep) -> MeResponse:
    return MeResponse.from_user(user)


@router.get("/categories", response_model=UserCategoriesResponse)
def get_my_categories(
    user: CurrentUserDep, user_categories: UserCategoryRepositoryDep
) -> UserCategoriesResponse:
    return UserCategoriesResponse(category_ids=user_categories.list_ids(user.id))


@router.put("/categories", response_model=UserCategoriesResponse)
def put_my_categories(
    body: UserCategoriesRequest,
    user: CurrentUserDep,
    user_categories: UserCategoryRepositoryDep,
) -> UserCategoriesResponse:
    """選択カテゴリを全件入れ替える（最大3件。上限は DB トリガーでも強制している）"""
    category_ids = parse_category_ids(",".join(body.category_ids))
    if len(category_ids) > FEED_MAX_CATEGORIES:
        raise AppError(422, ErrorCode.TOO_MANY_CATEGORIES)
    try:
        user_categories.replace(user.id, category_ids)
    except CategoryLimitExceededError:
        raise AppError(422, ErrorCode.TOO_MANY_CATEGORIES) from None
    except UnknownCategoryError:
        raise AppError(422, ErrorCode.CATEGORY_NOT_FOUND) from None
    return UserCategoriesResponse(category_ids=user_categories.list_ids(user.id))
