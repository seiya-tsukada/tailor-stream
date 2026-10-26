"""認証まわりの依存関数（現在のユーザー・Origin チェック）"""

from collections.abc import Iterator
from datetime import timedelta
from typing import Annotated

import httpx
from fastapi import Cookie, Depends, Request

from backend.auth.service import AuthService
from backend.config import ADMIN_PATH_PREFIX, SAFE_METHODS, SESSION_COOKIE_NAME
from backend.email.sender import EmailSender, create_email_sender
from backend.errors import AppError, ErrorCode
from backend.repositories.users import User
from backend.routes.deps import (
    LoginTokenRepositoryDep,
    SessionRepositoryDep,
    SettingsDep,
    UserRepositoryDep,
)


def get_email_sender(settings: SettingsDep) -> Iterator[EmailSender]:
    with httpx.Client() as client:
        yield create_email_sender(settings, client)


def get_auth_service(
    settings: SettingsDep,
    login_tokens: LoginTokenRepositoryDep,
    users: UserRepositoryDep,
    sessions: SessionRepositoryDep,
    email_sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> AuthService:
    return AuthService(
        login_tokens,
        users,
        sessions,
        email_sender,
        app_base_url=settings.app_base_url,
        session_ttl=timedelta(days=settings.session_ttl_days),
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
SessionCookie = Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)]


def get_optional_user(auth: AuthServiceDep, session_token: SessionCookie = None) -> User | None:
    """ログインしていればユーザー、していなければ None（ログイン任意の API 用）"""
    return auth.resolve(session_token)


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    """ログイン必須の API 用。未ログイン・セッション切れは 401"""
    if user is None:
        raise AppError(401, ErrorCode.UNAUTHORIZED)
    return user


OptionalUserDep = Annotated[User | None, Depends(get_optional_user)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


def verify_origin(request: Request, settings: SettingsDep) -> None:
    """CSRF 対策: GET 以外は Origin が APP_BASE_URL と一致しなければ 403

    /api/admin/* は Cookie を使わず Bearer トークンで守るため対象外（curl などから呼べるように）。
    """
    if request.method in SAFE_METHODS or request.url.path.startswith(ADMIN_PATH_PREFIX):
        return
    if request.headers.get("origin") != settings.app_base_url:
        raise AppError(403, ErrorCode.FORBIDDEN_ORIGIN)
