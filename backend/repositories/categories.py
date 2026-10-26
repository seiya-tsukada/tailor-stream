from typing import Protocol

from backend.db import DbConnection
from backend.feed.categories import Category


class CategoryRepository(Protocol):
    def list_active(self) -> list[Category]: ...

    def get_active(self, category_id: str) -> Category | None: ...


class PgCategoryRepository:
    def __init__(self, conn: DbConnection) -> None:
        self._conn = conn

    def list_active(self) -> list[Category]:
        rows = self._conn.execute(
            """
            select id, name_ja, name_en, description, sort_order, is_active
            from categories
            where is_active
            order by sort_order, id
            """
        ).fetchall()
        return [Category(**row) for row in rows]

    def get_active(self, category_id: str) -> Category | None:
        row = self._conn.execute(
            """
            select id, name_ja, name_en, description, sort_order, is_active
            from categories
            where id = %s and is_active
            """,
            (category_id,),
        ).fetchone()
        return Category(**row) if row else None
