"""リクエストからクライアント情報を取り出す"""

import ipaddress

from fastapi import Request

from backend.config import FORWARDED_FOR_HEADER, USER_AGENT_MAX_LENGTH


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get(FORWARDED_FOR_HEADER, "")
    candidate = forwarded.split(",")[0].strip() or (request.client.host if request.client else "")
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None


def user_agent(request: Request) -> str | None:
    value = request.headers.get("user-agent")
    return value[:USER_AGENT_MAX_LENGTH] if value else None
