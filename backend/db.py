"""DB 接続（psycopg 3）

- Supavisor の Transaction mode（6543）で接続するため、サーバー側プリペアドステートメントは使えない。
  prepare_threshold=None を必ず指定する。
- サーバーレス前提でリクエスト単位に接続し、リクエストの終わりに閉じる（プールは使わない）。
- autocommit で接続し、複数文をまとめる必要がある処理は repositories 側で conn.transaction() を使う。
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import Depends
from psycopg import Connection
from psycopg.rows import DictRow, dict_row

from backend.config import Settings, get_settings

DbConnection = Connection[DictRow]


@contextmanager
def connect(settings: Settings) -> Iterator[DbConnection]:
    conn = Connection.connect(
        settings.database_url,
        autocommit=True,
        prepare_threshold=None,
        row_factory=dict_row,
        connect_timeout=settings.db_connect_timeout_seconds,
    )
    try:
        yield conn
    finally:
        conn.close()


def get_connection(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Iterator[DbConnection]:
    """FastAPI の依存関数。リクエストごとに接続を開き、終わったら閉じる"""
    with connect(settings) as conn:
        yield conn
