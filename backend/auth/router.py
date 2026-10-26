from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status

from backend.auth.dependencies import AuthServiceDep, SessionCookie
from backend.auth.request_info import client_ip, user_agent
from backend.config import SESSION_COOKIE_NAME
from backend.models import ErrorResponse, LoginLinkRequest, MeResponse, VerifyRequest
from backend.routes.deps import SettingsDep

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    responses={
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
    },
)


@router.post("/login-link", status_code=status.HTTP_202_ACCEPTED)
def request_login_link(body: LoginLinkRequest, request: Request, auth: AuthServiceDep) -> None:
    """ログインリンクをメールで送る（登録済みかどうかに関係なく同じレスポンス）"""
    auth.request_login_link(body.email, client_ip(request))


@router.post("/verify", response_model=MeResponse)
def verify(
    body: VerifyRequest,
    request: Request,
    response: Response,
    auth: AuthServiceDep,
    settings: SettingsDep,
) -> MeResponse:
    """メールのリンクのトークンを検証してログインする（リンクスキャナーに消費されないよう POST のみ）"""
    issued = auth.verify(body.token, user_agent(request), client_ip(request))
    max_age = int((issued.expires_at - datetime.now(UTC)).total_seconds())
    response.set_cookie(
        SESSION_COOKIE_NAME,
        issued.token,
        max_age=max_age,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return MeResponse.from_user(issued.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    auth: AuthServiceDep,
    settings: SettingsDep,
    session_token: SessionCookie = None,
) -> None:
    auth.logout(session_token)
    response.delete_cookie(
        SESSION_COOKIE_NAME, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax"
    )
