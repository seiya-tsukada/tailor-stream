from datetime import datetime
from typing import Protocol

from backend.db import DbConnection


class LoginTokenRepository(Protocol):
    def count_recent_by_email(self, email: str, since: datetime) -> int: ...

    def count_recent_by_ip(self, ip: str, since: datetime) -> int: ...

    def create(self, email: str, token_hash: str, expires_at: datetime, ip: str | None) -> None: ...

    def consume(self, token_hash: str) -> str | None:
        """未使用・期限内のトークンを原子的に消費し、その email を返す（消費できなければ None）"""
        ...


class PgLoginTokenRepository:
    def __init__(self, conn: DbConnection) -> None:
        self._conn = conn

    def count_recent_by_email(self, email: str, since: datetime) -> int:
        row = self._conn.execute(
            "select count(*) as n from login_tokens where email = %s and created_at >= %s",
            (email, since),
        ).fetchone()
        return int(row["n"]) if row else 0

    def count_recent_by_ip(self, ip: str, since: datetime) -> int:
        row = self._conn.execute(
            "select count(*) as n from login_tokens where request_ip = %s and created_at >= %s",
            (ip, since),
        ).fetchone()
        return int(row["n"]) if row else 0

    def create(self, email: str, token_hash: str, expires_at: datetime, ip: str | None) -> None:
        self._conn.execute(
            """
            insert into login_tokens (email, token_hash, expires_at, request_ip)
            values (%s, %s, %s, %s)
            """,
            (email, token_hash, expires_at, ip),
        )

    def consume(self, token_hash: str) -> str | None:
        row = self._conn.execute(
            """
            update login_tokens
            set consumed_at = now()
            where token_hash = %s and consumed_at is null and expires_at > now()
            returning email
            """,
            (token_hash,),
        ).fetchone()
        return str(row["email"]) if row else None
