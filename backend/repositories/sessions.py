from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from backend.db import DbConnection
from backend.repositories.users import User


@dataclass(frozen=True)
class ActiveSession:
    id: UUID
    last_seen_at: datetime
    user: User


class SessionRepository(Protocol):
    def create(
        self,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip: str | None,
    ) -> None: ...

    def find_active(self, token_hash: str) -> ActiveSession | None:
        """失効・期限切れでないセッションとそのユーザーを返す"""
        ...

    def touch(self, session_id: UUID) -> None: ...

    def revoke(self, token_hash: str) -> None: ...


class PgSessionRepository:
    def __init__(self, conn: DbConnection) -> None:
        self._conn = conn

    def create(
        self,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip: str | None,
    ) -> None:
        self._conn.execute(
            """
            insert into sessions (user_id, token_hash, expires_at, user_agent, ip_address)
            values (%s, %s, %s, %s, %s)
            """,
            (user_id, token_hash, expires_at, user_agent, ip),
        )

    def find_active(self, token_hash: str) -> ActiveSession | None:
        row = self._conn.execute(
            """
            select
              s.id as session_id, s.last_seen_at,
              u.id, u.email, u.display_name, u.plan, u.plan_expires_at
            from sessions s
            join users u on u.id = s.user_id
            where s.token_hash = %s and s.revoked_at is null and s.expires_at > now()
            """,
            (token_hash,),
        ).fetchone()
        if row is None:
            return None
        session_id = row.pop("session_id")
        last_seen_at = row.pop("last_seen_at")
        return ActiveSession(id=session_id, last_seen_at=last_seen_at, user=User(**row))

    def touch(self, session_id: UUID) -> None:
        self._conn.execute("update sessions set last_seen_at = now() where id = %s", (session_id,))

    def revoke(self, token_hash: str) -> None:
        self._conn.execute(
            "update sessions set revoked_at = now() where token_hash = %s and revoked_at is null",
            (token_hash,),
        )
