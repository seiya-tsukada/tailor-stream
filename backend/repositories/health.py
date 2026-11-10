"""ヘルスチェック用の DB 疎通確認（select 1）"""

from typing import Protocol

from backend.config import Settings
from backend.db import connect


class HealthRepository(Protocol):
    def ping(self) -> None:
        """DB に接続して select 1 を実行する。つながらなければ psycopg.Error を送出する"""
        ...


class PgHealthRepository:
    """リクエスト単位の接続（get_connection）を使わず、ここで接続する。

    接続の失敗を依存関数の段階で 500 にせず、ヘルスチェックの結果（503）として返すため。
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def ping(self) -> None:
        with connect(self._settings) as conn:
            conn.execute("select 1").fetchone()
