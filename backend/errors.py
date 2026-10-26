"""API のエラー定義（クライアントには固定のコードとメッセージだけを返す）"""

from enum import StrEnum

from backend.config import ERROR_MESSAGES


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    TOO_MANY_CATEGORIES = "TOO_MANY_CATEGORIES"
    CATEGORY_NOT_FOUND = "CATEGORY_NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN_ORIGIN = "FORBIDDEN_ORIGIN"
    INVALID_EMAIL = "INVALID_EMAIL"
    RATE_LIMITED = "RATE_LIMITED"
    INVALID_TOKEN = "INVALID_TOKEN"  # noqa: S105  エラーコード名であり秘密ではない
    NOT_FOUND = "NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"


class AppError(Exception):
    """ハンドラで {"error": {"code", "message"}} に変換される例外"""

    def __init__(self, status_code: int, code: ErrorCode) -> None:
        super().__init__(code.value)
        self.status_code = status_code
        self.code = code

    @property
    def message(self) -> str:
        return ERROR_MESSAGES[self.code]
