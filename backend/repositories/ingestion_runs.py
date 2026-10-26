from typing import Literal, Protocol

from backend.db import DbConnection

FinishedStatus = Literal["succeeded", "failed"]


class IngestionRunRepository(Protocol):
    def start(self, provider: str, category_id: str) -> int:
        """status='running' の行を作り、その id を返す"""
        ...

    def finish(
        self,
        run_id: int,
        status: FinishedStatus,
        fetched_count: int | None,
        request_units: int | None,
        error: str | None,
    ) -> None: ...


class PgIngestionRunRepository:
    def __init__(self, conn: DbConnection) -> None:
        self._conn = conn

    def start(self, provider: str, category_id: str) -> int:
        row = self._conn.execute(
            """
            insert into ingestion_runs (provider, category_id, status)
            values (%s, %s, 'running')
            returning id
            """,
            (provider, category_id),
        ).fetchone()
        if row is None:
            raise RuntimeError("ingestion_runs の作成結果が返りませんでした")
        run_id: int = row["id"]
        return run_id

    def finish(
        self,
        run_id: int,
        status: FinishedStatus,
        fetched_count: int | None,
        request_units: int | None,
        error: str | None,
    ) -> None:
        self._conn.execute(
            """
            update ingestion_runs
            set status = %s, finished_at = now(), fetched_count = %s, request_units = %s, error = %s
            where id = %s
            """,
            (status, fetched_count, request_units, error, run_id),
        )
