from typing import Protocol
from uuid import UUID

from psycopg import errors

from backend.db import DbConnection

# DB トリガー（enforce_user_categories_limit）が上限超過時に付ける hint
CATEGORY_LIMIT_HINT = "category_limit_exceeded"


class CategoryLimitExceededError(Exception):
    """選択カテゴリが上限を超えた（DB トリガーで検出）"""


class UnknownCategoryError(Exception):
    """存在しないカテゴリが指定された（外部キー違反）"""


class UserCategoryRepository(Protocol):
    def list_ids(self, user_id: UUID) -> list[str]: ...

    def replace(self, user_id: UUID, category_ids: list[str]) -> None:
        """選択カテゴリを全件入れ替える（1トランザクション）"""
        ...


class PgUserCategoryRepository:
    def __init__(self, conn: DbConnection) -> None:
        self._conn = conn

    def list_ids(self, user_id: UUID) -> list[str]:
        rows = self._conn.execute(
            """
            select uc.category_id
            from user_categories uc
            join categories c on c.id = uc.category_id
            where uc.user_id = %s and c.is_active
            order by uc.created_at, c.sort_order
            """,
            (user_id,),
        ).fetchall()
        return [str(row["category_id"]) for row in rows]

    def replace(self, user_id: UUID, category_ids: list[str]) -> None:
        try:
            with self._conn.transaction(), self._conn.cursor() as cur:
                cur.execute("delete from user_categories where user_id = %s", (user_id,))
                # created_at を選択順にずらして、list_ids で順序を保つ
                cur.executemany(
                    """
                    insert into user_categories (user_id, category_id, created_at)
                    values (%s, %s, now() + make_interval(secs => %s * 0.001))
                    """,
                    [
                        (user_id, category_id, index)
                        for index, category_id in enumerate(category_ids)
                    ],
                )
        except errors.CheckViolation as err:
            if err.diag.message_hint == CATEGORY_LIMIT_HINT:
                raise CategoryLimitExceededError from err
            raise
        except errors.ForeignKeyViolation as err:
            raise UnknownCategoryError from err
