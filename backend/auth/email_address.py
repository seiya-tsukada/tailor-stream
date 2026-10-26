"""メールアドレスの正規化と形式検証"""

import re

from backend.config import EMAIL_MAX_LENGTH

# 実用上十分な簡易チェック（到達確認はマジックリンクそのもので行う）
_EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def normalize_email(raw: str) -> str | None:
    """前後の空白を除いて小文字化する。形式が不正なら None"""
    email = raw.strip().lower()
    if len(email) > EMAIL_MAX_LENGTH or not _EMAIL_PATTERN.fullmatch(email):
        return None
    return email
