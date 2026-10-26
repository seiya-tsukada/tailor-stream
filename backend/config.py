"""バックエンドの設定

- 環境変数（とリポジトリ直下の .env）から読む値は Settings にまとめる
- 環境変数で変えない固定の定数・メッセージもこのファイルに置く
"""

from functools import lru_cache
from typing import Final, Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

NewsProviderName = Literal["mock", "google_alerts_rss"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 必須（未設定なら起動時にエラー）
    database_url: str = Field(min_length=1)
    admin_secret: str = Field(min_length=16)

    # 任意
    news_provider: NewsProviderName = "mock"
    # カテゴリ ID → Google アラートの RSS URL（JSON）。未設定のカテゴリは取り込みをスキップする
    google_alerts_feeds: dict[str, str] = Field(default_factory=dict)
    article_ttl_hours: int = Field(default=48, gt=0)
    rss_timeout_seconds: float = Field(default=10.0, gt=0)
    rss_user_agent: str = "Mozilla/5.0 (compatible; TailorStreamBot/0.1)"
    db_connect_timeout_seconds: int = Field(default=10, gt=0)


class SettingsError(RuntimeError):
    """必須の環境変数が無い・不正なときのエラー（値そのものはメッセージに含めない）"""


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()  # 値は環境変数から読む
    except ValidationError as err:
        names = sorted({str(e["loc"][0]).upper() for e in err.errors() if e["loc"]})
        raise SettingsError(
            f"環境変数が未設定または不正です: {', '.join(names)}（.env.example を参照）"
        ) from None


# =============================================================
# 固定の定数
# =============================================================

API_PREFIX: Final = "/api"

# 一度に選べるカテゴリの最大数（DB トリガーの上限と合わせる）
FEED_MAX_CATEGORIES: Final = 3
# /api/feed が返す最大件数
FEED_LIMIT: Final = 100

# 記事 ID に使う SHA-256 16進文字列の長さ
ARTICLE_ID_LENGTH: Final = 32
UNTITLED_ARTICLE_TITLE: Final = "無題の記事"

# 人気度スコアの重み（docs/SPEC.md §5。媒体数・媒体の重み・鮮度は後続で追加する）
SCORE_WEIGHT_SHARE: Final = 1.0

RSS_ACCEPT: Final = "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
# Google アラートの RSS は言語・地域を返さないため、取り込み時はこの値を入れる
RSS_DEFAULT_LANGUAGE: Final = "ja"
RSS_DEFAULT_REGION: Final = "jp"

ADMIN_AUTH_SCHEME: Final = "Bearer"

# クライアントに返すエラー（コード → メッセージ）。内部の詳細はログにだけ残す
ERROR_MESSAGES: Final[dict[str, str]] = {
    "VALIDATION_ERROR": "リクエストの形式が正しくありません",
    "TOO_MANY_CATEGORIES": f"カテゴリは最大{FEED_MAX_CATEGORIES}つまで選べます",
    "CATEGORIES_REQUIRED": "カテゴリを1つ以上選んでください",
    "CATEGORY_NOT_FOUND": "指定されたカテゴリが見つかりません",
    "UNAUTHORIZED": "認証が必要です",
    "NOT_FOUND": "見つかりません",
    "INTERNAL_ERROR": "サーバーでエラーが発生しました",
    "SERVICE_UNAVAILABLE": "サーバーの設定に問題があります",
}
