"""ログイントークン・セッショントークンの生成とハッシュ化（DB には SHA-256 の16進だけを保存する）"""

import hashlib
import secrets

from backend.config import AUTH_TOKEN_BYTES


def generate_token() -> str:
    return secrets.token_urlsafe(AUTH_TOKEN_BYTES)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
