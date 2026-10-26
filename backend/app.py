"""FastAPI アプリ（ルーター登録・例外ハンドラ）

ローカル: uvicorn backend.app:app --reload --port 8000
Vercel:   api/index.py から読み込む（vercel.json で /api/* をここにルーティング）
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.config import API_PREFIX, ERROR_MESSAGES, SettingsError, get_settings
from backend.errors import AppError, ErrorCode
from backend.models import ErrorBody, ErrorResponse
from backend.routes import admin, categories, feed, health

logger = logging.getLogger(__name__)


def error_response(status_code: int, code: ErrorCode) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=ERROR_MESSAGES[code]))
    return JSONResponse(
        status_code=status_code, content=body.model_dump(mode="json", by_alias=True)
    )


async def handle_app_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        return await handle_unexpected_error(_request, exc)
    return error_response(exc.status_code, exc.code)


async def handle_validation_error(_request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, RequestValidationError):
        logger.info("リクエストの検証エラー: %s", exc.errors())
    return error_response(422, ErrorCode.VALIDATION_ERROR)


async def handle_http_error(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, StarletteHTTPException) and exc.status_code == 404:
        return error_response(404, ErrorCode.NOT_FOUND)
    status_code = exc.status_code if isinstance(exc, StarletteHTTPException) else 400
    logger.warning("HTTP エラー: %s %s %s", request.method, request.url.path, status_code)
    return error_response(status_code, ErrorCode.VALIDATION_ERROR)


async def handle_settings_error(_request: Request, exc: Exception) -> JSONResponse:
    logger.error("%s", exc)
    return error_response(503, ErrorCode.SERVICE_UNAVAILABLE)


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error("予期しないエラー: %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(500, ErrorCode.INTERNAL_ERROR)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # 必須の環境変数が無ければ起動時に止める（SettingsError のメッセージに不足している変数名が出る）
    get_settings()
    yield


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO)
    app = FastAPI(
        title="TailorStream API",
        version="0.1.0",
        lifespan=lifespan,
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
    )

    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_error)
    app.add_exception_handler(SettingsError, handle_settings_error)
    app.add_exception_handler(Exception, handle_unexpected_error)

    # エラー時のレスポンス形式を OpenAPI（= フロントの生成型）に載せる
    error_responses: dict[int | str, dict[str, Any]] = {
        status: {"model": ErrorResponse} for status in (422, 500)
    }
    for module in (health, categories, feed, admin):
        app.include_router(module.router, prefix=API_PREFIX, responses=error_responses)
    return app


app = create_app()
