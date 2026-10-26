"""マジックリンク認証・ログイン任意の API のテスト（フェイクを使い DB には接続しない）"""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from backend.auth.email_address import normalize_email
from backend.auth.service import AuthService
from backend.auth.tokens import hash_token
from backend.config import Settings
from backend.errors import AppError, ErrorCode
from tests.conftest import APP_BASE_URL
from tests.fakes import (
    FakeArticleRepository,
    FakeClock,
    FakeEmailSender,
    FakeLoginTokenRepository,
    FakeSessionRepository,
    FakeUserCategoryRepository,
    FakeUserRepository,
)

EMAIL = "alice@example.com"


@pytest.fixture
def auth(
    clock: FakeClock,
    login_token_repo: FakeLoginTokenRepository,
    user_repo: FakeUserRepository,
    session_repo: FakeSessionRepository,
    email_sender: FakeEmailSender,
) -> AuthService:
    return AuthService(
        login_token_repo,
        user_repo,
        session_repo,
        email_sender,
        app_base_url=APP_BASE_URL,
        session_ttl=timedelta(days=30),
        now=clock,
    )


def login(client: TestClient, email_sender: FakeEmailSender, email: str = EMAIL) -> None:
    """ログインリンクを要求して検証まで行い、client に Cookie を持たせる"""
    assert client.post("/api/auth/login-link", json={"email": email}).status_code == 202
    response = client.post("/api/auth/verify", json={"token": email_sender.last_token()})
    assert response.status_code == 200


def test_normalize_email() -> None:
    assert normalize_email("  Alice@Example.COM ") == "alice@example.com"
    assert normalize_email("not-an-email") is None
    assert normalize_email("a@b") is None
    assert normalize_email("a b@example.com") is None
    assert normalize_email("a" * 250 + "@example.com") is None


class TestAuthService:
    def test_ログインリンクを送りトークンはハッシュだけを保存する(
        self,
        auth: AuthService,
        email_sender: FakeEmailSender,
        login_token_repo: FakeLoginTokenRepository,
    ) -> None:
        auth.request_login_link(" Alice@Example.com ", "203.0.113.1")

        [message] = email_sender.sent
        assert message.to == EMAIL
        assert f"{APP_BASE_URL}/auth/verify?token=" in message.text
        token = email_sender.last_token()
        [stored] = login_token_repo.tokens
        assert stored.token_hash == hash_token(token)
        assert token not in stored.token_hash

    def test_トークンの消費は1回しか成功しない(
        self, auth: AuthService, email_sender: FakeEmailSender, user_repo: FakeUserRepository
    ) -> None:
        auth.request_login_link(EMAIL, None)
        token = email_sender.last_token()

        issued = auth.verify(token, "ua", None)
        assert issued.user.email == EMAIL
        with pytest.raises(AppError) as err:
            auth.verify(token, "ua", None)
        assert err.value.code == ErrorCode.INVALID_TOKEN
        assert user_repo.login_count[EMAIL] == 1

    def test_期限切れのトークンは失敗する(
        self, auth: AuthService, email_sender: FakeEmailSender, clock: FakeClock
    ) -> None:
        auth.request_login_link(EMAIL, None)
        clock.advance(minutes=15, seconds=1)
        with pytest.raises(AppError) as err:
            auth.verify(email_sender.last_token(), None, None)
        assert err.value.code == ErrorCode.INVALID_TOKEN

    def test_存在しないトークンや空のトークンは失敗する(self, auth: AuthService) -> None:
        for token in ("unknown", ""):
            with pytest.raises(AppError):
                auth.verify(token, None, None)

    def test_同一メールは15分に3回まで(self, auth: AuthService, clock: FakeClock) -> None:
        for _ in range(3):
            auth.request_login_link(EMAIL, None)
        with pytest.raises(AppError) as err:
            auth.request_login_link(EMAIL, None)
        assert err.value.code == ErrorCode.RATE_LIMITED

        clock.advance(minutes=15, seconds=1)
        auth.request_login_link(EMAIL, None)

    def test_同一IPは1時間に10回まで(self, auth: AuthService, clock: FakeClock) -> None:
        for i in range(10):
            auth.request_login_link(f"user{i}@example.com", "203.0.113.1")
        with pytest.raises(AppError) as err:
            auth.request_login_link("other@example.com", "203.0.113.1")
        assert err.value.code == ErrorCode.RATE_LIMITED
        # 別の IP からは送れる
        auth.request_login_link("other@example.com", "203.0.113.2")

        clock.advance(hours=1, seconds=1)
        auth.request_login_link("later@example.com", "203.0.113.1")

    def test_セッションの最終利用時刻は1時間以上経ったときだけ更新する(
        self,
        auth: AuthService,
        email_sender: FakeEmailSender,
        session_repo: FakeSessionRepository,
        clock: FakeClock,
    ) -> None:
        auth.request_login_link(EMAIL, None)
        issued = auth.verify(email_sender.last_token(), None, None)

        clock.advance(minutes=59)
        assert auth.resolve(issued.token) is not None
        assert session_repo.touched == []

        clock.advance(minutes=1)
        assert auth.resolve(issued.token) is not None
        assert len(session_repo.touched) == 1

    def test_期限切れやログアウト済みのセッションは無効(
        self, auth: AuthService, email_sender: FakeEmailSender, clock: FakeClock
    ) -> None:
        auth.request_login_link(EMAIL, None)
        first = auth.verify(email_sender.last_token(), None, None)
        auth.request_login_link(EMAIL, None)
        second = auth.verify(email_sender.last_token(), None, None)

        auth.logout(first.token)
        assert auth.resolve(first.token) is None
        assert auth.resolve(second.token) is not None

        clock.advance(days=30)
        assert auth.resolve(second.token) is None
        assert auth.resolve(None) is None


class TestAuthApi:
    def test_ログインリンクの要求は登録済みかどうかに関係なく同じレスポンス(
        self, client: TestClient, email_sender: FakeEmailSender
    ) -> None:
        login(client, email_sender)
        client.cookies.clear()

        registered = client.post("/api/auth/login-link", json={"email": EMAIL})
        new = client.post("/api/auth/login-link", json={"email": "new@example.com"})
        assert (registered.status_code, registered.content) == (new.status_code, new.content)

    def test_不正なメールアドレスは422(self, client: TestClient) -> None:
        response = client.post("/api/auth/login-link", json={"email": "nope"})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "INVALID_EMAIL"

    def test_レート制限は429(self, client: TestClient) -> None:
        for _ in range(3):
            client.post("/api/auth/login-link", json={"email": EMAIL})
        response = client.post("/api/auth/login-link", json={"email": EMAIL})
        assert response.status_code == 429
        assert response.json()["error"]["code"] == "RATE_LIMITED"

    def test_IPはx_forwarded_forの先頭を使う(
        self, client: TestClient, login_token_repo: FakeLoginTokenRepository
    ) -> None:
        client.post(
            "/api/auth/login-link",
            json={"email": EMAIL},
            headers={"X-Forwarded-For": "203.0.113.9, 10.0.0.1"},
        )
        assert login_token_repo.tokens[0].ip == "203.0.113.9"

    def test_verifyでセッションCookieを発行する(
        self, client: TestClient, email_sender: FakeEmailSender, settings: Settings
    ) -> None:
        client.post("/api/auth/login-link", json={"email": EMAIL})
        response = client.post("/api/auth/verify", json={"token": email_sender.last_token()})

        assert response.status_code == 200
        assert response.json()["email"] == EMAIL
        assert response.json()["plan"] == "free"
        cookie = response.headers["set-cookie"]
        assert cookie.startswith("ts_session=")
        assert "HttpOnly" in cookie
        assert "SameSite=lax" in cookie
        assert "Path=/" in cookie
        assert (
            f"Max-Age={30 * 24 * 60 * 60 - 1}" in cookie or f"Max-Age={30 * 24 * 60 * 60}" in cookie
        )
        # http://localhost では Secure を付けない（本番の https では付ける）
        assert "Secure" not in cookie
        assert not settings.cookie_secure

    def test_使用済みトークンのverifyは400(
        self, client: TestClient, email_sender: FakeEmailSender
    ) -> None:
        login(client, email_sender)
        response = client.post("/api/auth/verify", json={"token": email_sender.last_token()})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_TOKEN"

    def test_GETではトークンを消費しない(
        self, client: TestClient, email_sender: FakeEmailSender
    ) -> None:
        client.post("/api/auth/login-link", json={"email": EMAIL})
        token = email_sender.last_token()
        assert client.get("/api/auth/verify", params={"token": token}).status_code == 405
        assert client.post("/api/auth/verify", json={"token": token}).status_code == 200

    def test_meはログイン中のユーザーを返しログアウト後は401(
        self, client: TestClient, email_sender: FakeEmailSender
    ) -> None:
        login(client, email_sender)
        me = client.get("/api/me")
        assert me.status_code == 200
        assert set(me.json()) == {"id", "email", "displayName", "plan", "planExpiresAt"}

        logout = client.post("/api/auth/logout")
        assert logout.status_code == 204
        assert 'ts_session=""' in logout.headers["set-cookie"]
        assert client.get("/api/me").status_code == 401


class TestLoginRequired:
    @pytest.mark.parametrize(
        ("method", "path"),
        [("GET", "/api/me"), ("GET", "/api/me/categories"), ("PUT", "/api/me/categories")],
    )
    def test_ログイン必須のAPIは未ログインで401(
        self, client: TestClient, method: str, path: str
    ) -> None:
        response = client.request(method, path, json={"categoryIds": ["ai"]})
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"

    def test_不正なセッションCookieは401(self, client: TestClient) -> None:
        client.cookies.set("ts_session", "forged")
        assert client.get("/api/me").status_code == 401

    @pytest.mark.parametrize("path", ["/api/health", "/api/categories", "/api/feed"])
    def test_ログイン任意のAPIは未ログインでも使える(self, client: TestClient, path: str) -> None:
        assert client.get(path).status_code == 200


class TestOrigin:
    @pytest.mark.parametrize("origin", [None, "https://evil.example.com", "http://localhost:3000"])
    def test_Originが一致しないPOSTは403(self, client: TestClient, origin: str | None) -> None:
        headers = {"Origin": origin} if origin else {}
        client.headers.pop("Origin")
        response = client.post("/api/auth/login-link", json={"email": EMAIL}, headers=headers)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN_ORIGIN"

    def test_GETはOriginを問わない(self, client: TestClient) -> None:
        response = client.get("/api/categories", headers={"Origin": "https://evil.example.com"})
        assert response.status_code == 200

    def test_管理APIはOriginではなくBearerで守る(self, client: TestClient) -> None:
        client.headers.pop("Origin")
        assert client.post("/api/admin/ingest").status_code == 401


class TestUserCategories:
    def test_選択カテゴリを保存して取得できる(
        self, client: TestClient, email_sender: FakeEmailSender
    ) -> None:
        login(client, email_sender)
        assert client.get("/api/me/categories").json() == {"categoryIds": []}

        response = client.put("/api/me/categories", json={"categoryIds": ["web3", "ai", "web3"]})
        assert response.status_code == 200
        assert response.json() == {"categoryIds": ["web3", "ai"]}
        assert client.get("/api/me/categories").json() == {"categoryIds": ["web3", "ai"]}

    def test_4つ以上は422(self, client: TestClient, email_sender: FakeEmailSender) -> None:
        login(client, email_sender)
        response = client.put(
            "/api/me/categories", json={"categoryIds": ["ai", "web3", "startup", "fintech"]}
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "TOO_MANY_CATEGORIES"

    def test_DBトリガーの上限超過も422に変換する(
        self,
        client: TestClient,
        email_sender: FakeEmailSender,
        user_category_repo: FakeUserCategoryRepository,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        login(client, email_sender)
        # API 側の件数チェックをすり抜けた場合でも、トリガーのエラーを 422 にする
        monkeypatch.setattr("backend.routes.me.FEED_MAX_CATEGORIES", 10)
        response = client.put(
            "/api/me/categories", json={"categoryIds": ["ai", "web3", "startup", "fintech"]}
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "TOO_MANY_CATEGORIES"

    def test_存在しないカテゴリは422(
        self, client: TestClient, email_sender: FakeEmailSender
    ) -> None:
        login(client, email_sender)
        response = client.put("/api/me/categories", json={"categoryIds": ["unknown"]})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "CATEGORY_NOT_FOUND"

    def test_ログイン中のfeedはクエリではなくユーザー設定を使う(
        self,
        client: TestClient,
        email_sender: FakeEmailSender,
        article_repo: FakeArticleRepository,
    ) -> None:
        login(client, email_sender)
        empty = client.get("/api/feed", params={"categories": "ai"})
        assert empty.json() == {"categoryIds": [], "articles": []}

        client.put("/api/me/categories", json={"categoryIds": ["security"]})
        response = client.get("/api/feed", params={"categories": "ai"})
        assert response.json()["categoryIds"] == ["security"]
        assert article_repo.feed_calls == [(["security"], 100)]
