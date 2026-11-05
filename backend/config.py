"""バックエンドの設定

- 環境変数（とリポジトリ直下の .env）から読む値は Settings にまとめる
- 環境変数で変えない固定の定数・メッセージもこのファイルに置く
"""

from functools import lru_cache
from typing import Final, Literal, Self
from urllib.parse import urlsplit

from pydantic import Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

NewsProviderName = Literal["mock", "google_alerts_rss"]
EmailProviderName = Literal["console", "resend"]
LOCAL_HOSTS: Final = frozenset({"localhost", "127.0.0.1", "::1"})
# APP_BASE_URL も VERCEL_PROJECT_PRODUCTION_URL も無いときのフロントの URL（Vite の既定ポート）
DEFAULT_APP_BASE_URL: Final = "http://localhost:5173"
ADMIN_SECRET_MIN_LENGTH: Final = 16


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 記事の取得元。mock のときは DATABASE_URL・ADMIN_SECRET・メール設定が無くても動く（下記のフェイルオーバー）
    news_provider: NewsProviderName = "mock"

    # mock 以外では必須。mock で未設定ならメモリ上のストア（モック記事・プロセス内だけのユーザーデータ）で動く
    database_url: str | None = Field(default=None, min_length=1)
    # mock 以外では必須。未設定なら管理 API（/api/admin/*）は 503
    admin_secret: str | None = Field(default=None, min_length=ADMIN_SECRET_MIN_LENGTH)

    # フロントの URL（例: https://tailor-stream.vercel.app）。ログインリンクと Origin チェックに使う。
    # 未設定なら Vercel の本番 URL（VERCEL_PROJECT_PRODUCTION_URL）、それも無ければ DEFAULT_APP_BASE_URL
    app_base_url: str = ""
    # Vercel が実行時に自動で入れるシステム環境変数（本番ドメイン。スキーム無し）
    vercel_project_production_url: str | None = None

    # 任意
    # カテゴリ ID → Google アラートの RSS URL（JSON）。未設定のカテゴリは取り込みをスキップする
    google_alerts_feeds: dict[str, str] = Field(default_factory=dict)
    article_ttl_hours: int = Field(default=48, gt=0)
    rss_timeout_seconds: float = Field(default=10.0, gt=0)
    rss_user_agent: str = "Mozilla/5.0 (compatible; TailorStreamBot/0.1)"
    db_connect_timeout_seconds: int = Field(default=10, gt=0)
    session_ttl_days: int = Field(default=30, gt=0)
    # 未設定なら自動で選ぶ（effective_email_provider を参照）
    email_provider: EmailProviderName | None = None
    resend_api_key: str | None = None
    email_from: str | None = None

    @field_validator(
        "database_url",
        "admin_secret",
        "email_provider",
        "resend_api_key",
        "email_from",
        "vercel_project_production_url",
        mode="before",
    )
    @classmethod
    def _empty_to_none(cls, value: object) -> object:
        # .env の「DATABASE_URL=」のような空値は未設定として扱う
        return None if isinstance(value, str) and not value.strip() else value

    @model_validator(mode="after")
    def _resolve(self) -> Self:
        self.app_base_url = _normalize_base_url(self._raw_app_base_url())
        if self.news_provider != "mock":
            missing = [
                name
                for name, value in (
                    ("DATABASE_URL", self.database_url),
                    ("ADMIN_SECRET", self.admin_secret),
                )
                if value is None
            ]
            if missing:
                raise ValueError(
                    f"NEWS_PROVIDER={self.news_provider} には {', '.join(missing)} が必要です"
                )
        return self

    def _raw_app_base_url(self) -> str:
        if self.app_base_url.strip():
            return self.app_base_url.strip()
        if self.vercel_project_production_url:
            return f"https://{self.vercel_project_production_url}"
        return DEFAULT_APP_BASE_URL

    @property
    def is_local(self) -> bool:
        return urlsplit(self.app_base_url).hostname in LOCAL_HOSTS

    @property
    def uses_memory_store(self) -> bool:
        """DATABASE_URL が無い（mock のときだけ許される）ならメモリ上のストアを使う"""
        return self.database_url is None

    @property
    def effective_email_provider(self) -> EmailProviderName | None:
        """実際に使うメール送信の実装。None ならログインリンクを送れない（ログイン機能は 503）

        - resend: RESEND_API_KEY と EMAIL_FROM がそろっているときだけ
        - console: ログインリンク（秘密）をログに出すため、ローカル開発（APP_BASE_URL が localhost）でだけ
        - EMAIL_PROVIDER が未設定なら resend → console の順に使えるものを選ぶ
        """
        resend_ready = self.resend_api_key is not None and self.email_from is not None
        candidates: tuple[EmailProviderName, ...] = (
            (self.email_provider,) if self.email_provider else ("resend", "console")
        )
        for candidate in candidates:
            if candidate == "resend" and resend_ready:
                return "resend"
            if candidate == "console" and self.is_local:
                return "console"
        return None

    @property
    def cookie_secure(self) -> bool:
        """本番（https）では Cookie に Secure を付ける"""
        return self.app_base_url.startswith("https://")


def _normalize_base_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("APP_BASE_URL は http(s)://ホスト 形式で指定してください")
    # Origin ヘッダと比較するため、スキーム + ホスト[:ポート] だけに揃える
    return f"{parts.scheme}://{parts.netloc}"


def describe_fallbacks(settings: Settings) -> list[str]:
    """フェイルオーバーで動いている機能の説明（起動時にログへ出す。値そのものは含めない）"""
    notes: list[str] = []
    if settings.uses_memory_store:
        notes.append("DATABASE_URL が未設定のため、メモリ上のストア（モック記事）で動きます")
    if settings.admin_secret is None:
        notes.append("ADMIN_SECRET が未設定のため、管理 API は使えません")
    if settings.effective_email_provider is None:
        notes.append("メール送信の設定が無いため、ログイン機能は使えません")
    return notes


class SettingsError(RuntimeError):
    """必須の環境変数が無い・不正なときのエラー（値そのものはメッセージに含めない）"""


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()  # 値は環境変数から読む
    except ValidationError as err:
        names = sorted({str(e["loc"][0]).upper() for e in err.errors() if e["loc"]})
        # model_validator のエラーは loc が空なので、固定のメッセージ（値を含まない）をそのまま出す
        details = [str(e["msg"]) for e in err.errors() if not e["loc"]]
        raise SettingsError(
            "環境変数が未設定または不正です: "
            + ", ".join(names + details)
            + "（.env.example を参照）"
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

# DATABASE_URL が無いときのメモリ上のストアに、モック記事を入れ直す間隔（分）
MEMORY_STORE_RESEED_MINUTES: Final = 60

ADMIN_AUTH_SCHEME: Final = "Bearer"
ADMIN_PATH_PREFIX: Final = f"{API_PREFIX}/admin"

# =============================================================
# 認証（メールのマジックリンク。docs/SPEC.md §8）
# =============================================================

# トークンは secrets.token_urlsafe(この値) で作る（バイト数）
AUTH_TOKEN_BYTES: Final = 32
LOGIN_TOKEN_TTL_MINUTES: Final = 15
# ログインリンクのパス（フロントのページ）
LOGIN_VERIFY_PATH: Final = "/auth/verify"
# レート制限（login_tokens の件数で判定）
LOGIN_RATE_LIMIT_PER_EMAIL: Final = 3
LOGIN_RATE_LIMIT_EMAIL_WINDOW_MINUTES: Final = 15
LOGIN_RATE_LIMIT_PER_IP: Final = 10
LOGIN_RATE_LIMIT_IP_WINDOW_MINUTES: Final = 60
# sessions.last_seen_at は前回からこの時間以上経ったときだけ更新する
SESSION_TOUCH_INTERVAL_MINUTES: Final = 60
SESSION_COOKIE_NAME: Final = "ts_session"
# Vercel は x-forwarded-for の先頭にクライアントの IP を入れる
FORWARDED_FOR_HEADER: Final = "x-forwarded-for"
USER_AGENT_MAX_LENGTH: Final = 512
EMAIL_MAX_LENGTH: Final = 254
# GET 以外でも Origin チェックをしないメソッド
SAFE_METHODS: Final = frozenset({"GET", "HEAD", "OPTIONS"})

# メール送信
RESEND_API_URL: Final = "https://api.resend.com/emails"
EMAIL_TIMEOUT_SECONDS: Final = 10.0
LOGIN_EMAIL_SUBJECT: Final = "TailorStream ログインリンク"
LOGIN_EMAIL_BODY: Final = (
    "以下のリンクから TailorStream にログインしてください（{minutes}分間有効）。\n\n"
    "{link}\n\n"
    "このメールに心当たりがない場合は破棄してください。"
)

# クライアントに返すエラー（コード → メッセージ）。内部の詳細はログにだけ残す
ERROR_MESSAGES: Final[dict[str, str]] = {
    "VALIDATION_ERROR": "リクエストの形式が正しくありません",
    "TOO_MANY_CATEGORIES": f"カテゴリは最大{FEED_MAX_CATEGORIES}つまで選べます",
    "CATEGORY_NOT_FOUND": "指定されたカテゴリが見つかりません",
    "UNAUTHORIZED": "ログインが必要です",
    "FORBIDDEN_ORIGIN": "許可されていない送信元からのリクエストです",
    "INVALID_EMAIL": "メールアドレスの形式が正しくありません",
    "RATE_LIMITED": "リクエストが多すぎます。しばらくしてから再度お試しください",
    "INVALID_TOKEN": "ログインリンクが無効か、有効期限が切れています",
    "NOT_FOUND": "見つかりません",
    "INTERNAL_ERROR": "サーバーでエラーが発生しました",
    "SERVICE_UNAVAILABLE": "サーバーの設定に問題があります",
    "LOGIN_UNAVAILABLE": "現在ログイン機能は利用できません",
    "ADMIN_UNAVAILABLE": "管理 API は設定されていません",
}
