from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol
from uuid import UUID

from backend.db import DbConnection

Plan = Literal["free", "pro"]


@dataclass(frozen=True)
class User:
    id: UUID
    email: str
    display_name: str | None
    plan: Plan
    plan_expires_at: datetime | None


class UserRepository(Protocol):
    def upsert_on_login(self, email: str) -> User:
        """email でユーザーを作成または取得し、ログイン時刻を更新する（初回は email_verified_at も設定）"""
        ...


class PgUserRepository:
    def __init__(self, conn: DbConnection) -> None:
        self._conn = conn

    def upsert_on_login(self, email: str) -> User:
        row = self._conn.execute(
            """
            insert into users (email, email_verified_at, last_login_at)
            values (%s, now(), now())
            on conflict (email) do update set
              email_verified_at = coalesce(users.email_verified_at, now()),
              last_login_at = now(),
              updated_at = now()
            returning id, email, display_name, plan, plan_expires_at
            """,
            (email,),
        ).fetchone()
        if row is None:
            raise RuntimeError("users の upsert 結果が返りませんでした")
        return User(**row)
