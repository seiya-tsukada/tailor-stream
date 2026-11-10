"""supabase/migrations の冪等性（何度流しても同じ結果になること）

- 静的チェック: 「無いときだけ作る」「置き換える」形でしか作成していないこと（DB 不要）
- 実 DB: 適用済みの DB に init.sql をもう一度流してもエラーにならないこと（TEST_DATABASE_URL があるときだけ）
"""

import re
from pathlib import Path

import pytest
from psycopg import Connection

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "supabase" / "migrations"
MIGRATION_FILES = sorted(MIGRATIONS_DIR.glob("*.sql"))

# 冪等でない作成文（if not exists / or replace が無いもの）
NON_IDEMPOTENT = re.compile(
    r"^\s*create\s+(?!or\s+replace\b)(?:unique\s+)?"
    r"(?:table|index|schema|function|trigger|view|sequence)\s+(?!if\s+not\s+exists\b)",
    re.IGNORECASE | re.MULTILINE,
)
# 制約の追加は存在チェック（do ブロック）の中でだけ行う
ADD_CONSTRAINT = re.compile(
    r"^alter\s+table\b[^;]*\badd\s+constraint\b", re.IGNORECASE | re.MULTILINE
)


def test_マイグレーションのファイル名に日付を付けない() -> None:
    assert (MIGRATIONS_DIR / "init.sql").is_file()
    for file in MIGRATION_FILES:
        assert not re.match(r"^\d{8,}", file.name), file.name


@pytest.mark.parametrize("file", MIGRATION_FILES, ids=lambda f: f.name)
def test_作成文はすべて冪等(file: Path) -> None:
    sql = file.read_text(encoding="utf-8")
    assert NON_IDEMPOTENT.findall(sql) == []
    assert ADD_CONSTRAINT.findall(sql) == [], "add constraint は存在チェックの do ブロック内に書く"


def test_適用済みのDBにもう一度流してもエラーにならない(test_database_url: str) -> None:
    with Connection.connect(test_database_url, prepare_threshold=None) as conn:
        try:
            # テスト用 DB は適用済みなので、ここで流すのが2回目になる
            for file in MIGRATION_FILES:
                conn.execute(file.read_text(encoding="utf-8"))  # type: ignore[arg-type]
        finally:
            conn.rollback()
