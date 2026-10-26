from datetime import timedelta

from fastapi import APIRouter, Depends

from backend.errors import AppError, ErrorCode
from backend.ingestion.service import IngestionService
from backend.models import ErrorResponse, IngestRequest, IngestResponse, IngestResultOut
from backend.routes.deps import (
    ArticleRepositoryDep,
    CategoryRepositoryDep,
    IngestionRunRepositoryDep,
    NewsProviderDep,
    SettingsDep,
    require_admin,
)

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)


@router.post("/ingest", response_model=IngestResponse)
def ingest(
    settings: SettingsDep,
    categories: CategoryRepositoryDep,
    articles: ArticleRepositoryDep,
    runs: IngestionRunRepositoryDep,
    provider: NewsProviderDep,
    body: IngestRequest | None = None,
) -> IngestResponse:
    """記事を手動で取り込む（categoryId を省略すると全アクティブカテゴリ）"""
    if body is not None and body.category_id is not None:
        category = categories.get_active(body.category_id)
        if category is None:
            raise AppError(404, ErrorCode.CATEGORY_NOT_FOUND)
        targets = [category]
    else:
        targets = categories.list_active()

    service = IngestionService(
        provider, articles, runs, article_ttl=timedelta(hours=settings.article_ttl_hours)
    )
    outcomes = service.ingest(targets)
    return IngestResponse(
        provider=provider.name,
        results=[
            IngestResultOut(
                category_id=outcome.category_id,
                status=outcome.status,
                fetched_count=outcome.fetched_count,
                stored_count=outcome.stored_count,
            )
            for outcome in outcomes
        ],
    )
