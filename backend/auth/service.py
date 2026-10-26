"""マジックリンク認証（docs/SPEC.md §8）"""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from backend.auth.email_address import normalize_email
from backend.auth.tokens import generate_token, hash_token
from backend.config import (
    LOGIN_EMAIL_BODY,
    LOGIN_EMAIL_SUBJECT,
    LOGIN_RATE_LIMIT_EMAIL_WINDOW_MINUTES,
    LOGIN_RATE_LIMIT_IP_WINDOW_MINUTES,
    LOGIN_RATE_LIMIT_PER_EMAIL,
    LOGIN_RATE_LIMIT_PER_IP,
    LOGIN_TOKEN_TTL_MINUTES,
    LOGIN_VERIFY_PATH,
    SESSION_TOUCH_INTERVAL_MINUTES,
)
from backend.email.sender import EmailMessage, EmailSender
from backend.errors import AppError, ErrorCode
from backend.repositories.login_tokens import LoginTokenRepository
from backend.repositories.sessions import SessionRepository
from backend.repositories.users import User, UserRepository

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IssuedSession:
    token: str
    expires_at: datetime
    user: User


class AuthService:
    def __init__(
        self,
        login_tokens: LoginTokenRepository,
        users: UserRepository,
        sessions: SessionRepository,
        email_sender: EmailSender,
        app_base_url: str,
        session_ttl: timedelta,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._login_tokens = login_tokens
        self._users = users
        self._sessions = sessions
        self._email_sender = email_sender
        self._app_base_url = app_base_url
        self._session_ttl = session_ttl
        self._now = now or (lambda: datetime.now(UTC))

    def request_login_link(self, raw_email: str, ip: str | None) -> None:
        """ログインリンクをメールで送る。登録済みかどうかで結果を変えない（アカウント存在の推測を防ぐ）"""
        email = normalize_email(raw_email)
        if email is None:
            raise AppError(422, ErrorCode.INVALID_EMAIL)

        now = self._now()
        email_since = now - timedelta(minutes=LOGIN_RATE_LIMIT_EMAIL_WINDOW_MINUTES)
        if (
            self._login_tokens.count_recent_by_email(email, email_since)
            >= LOGIN_RATE_LIMIT_PER_EMAIL
        ):
            raise AppError(429, ErrorCode.RATE_LIMITED)
        ip_since = now - timedelta(minutes=LOGIN_RATE_LIMIT_IP_WINDOW_MINUTES)
        if (
            ip is not None
            and self._login_tokens.count_recent_by_ip(ip, ip_since) >= LOGIN_RATE_LIMIT_PER_IP
        ):
            raise AppError(429, ErrorCode.RATE_LIMITED)

        token = generate_token()
        self._login_tokens.create(
            email, hash_token(token), now + timedelta(minutes=LOGIN_TOKEN_TTL_MINUTES), ip
        )
        link = f"{self._app_base_url}{LOGIN_VERIFY_PATH}?{urlencode({'token': token})}"
        self._email_sender.send(
            EmailMessage(
                to=email,
                subject=LOGIN_EMAIL_SUBJECT,
                text=LOGIN_EMAIL_BODY.format(minutes=LOGIN_TOKEN_TTL_MINUTES, link=link),
            )
        )

    def verify(self, token: str, user_agent: str | None, ip: str | None) -> IssuedSession:
        """ログイントークンを消費してユーザーを作成・取得し、セッションを発行する"""
        email = self._login_tokens.consume(hash_token(token)) if token else None
        if email is None:
            raise AppError(400, ErrorCode.INVALID_TOKEN)

        user = self._users.upsert_on_login(email)
        session_token = generate_token()
        expires_at = self._now() + self._session_ttl
        self._sessions.create(user.id, hash_token(session_token), expires_at, user_agent, ip)
        return IssuedSession(token=session_token, expires_at=expires_at, user=user)

    def resolve(self, session_token: str | None) -> User | None:
        """Cookie のセッショントークンからユーザーを引く。無効なら None"""
        if not session_token:
            return None
        session = self._sessions.find_active(hash_token(session_token))
        if session is None:
            return None
        if self._now() - session.last_seen_at >= timedelta(minutes=SESSION_TOUCH_INTERVAL_MINUTES):
            self._sessions.touch(session.id)
        return session.user

    def logout(self, session_token: str | None) -> None:
        if session_token:
            self._sessions.revoke(hash_token(session_token))
