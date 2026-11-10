import logging
from datetime import UTC, datetime

import psycopg
from fastapi import APIRouter, Response

from backend.models import DatabaseHealth, HealthResponse
from backend.routes.deps import HealthRepositoryDep

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "DB に接続できない"}},
)
def health(repo: HealthRepositoryDep, response: Response) -> HealthResponse:
    """死活監視。DB は select 1 で疎通を確認する（DATA_BACKEND=memory なら確認しない）"""
    database: DatabaseHealth
    if repo is None:
        database = "skipped"
    else:
        try:
            repo.ping()
        except psycopg.Error:
            # 接続先などの詳細はログにだけ残す
            logger.exception("ヘルスチェック: DB に接続できません")
            database = "error"
        else:
            database = "ok"

    if database == "error":
        response.status_code = 503
        return HealthResponse(status="error", database=database, timestamp=datetime.now(UTC))
    return HealthResponse(status="ok", database=database, timestamp=datetime.now(UTC))
