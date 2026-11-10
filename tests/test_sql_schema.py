"""SQL のテーブル参照がスキーマ付き（tailor_stream.xxx）であること

アプリはオーナーロールで接続し、search_path に頼らない。スキーマを付け忘れると
本番（postgres ロール）で relation does not exist になるため、静的に検出する。
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLES = re.findall(
    r"create table if not exists tailor_stream\.(\w+)",
    (ROOT / "supabase" / "migrations" / "init.sql").read_text(encoding="utf-8"),
)
UNQUALIFIED = re.compile(
    r"\b(?:from|join|into|update|truncate(?:\s+table)?)\s+(" + "|".join(TABLES) + r")\b",
    re.IGNORECASE,
)
# DB を使わないモック実装（SQL を書かない）
EXCLUDED = {ROOT / "backend" / "repositories" / "memory.py"}


def test_テーブル一覧をinit_sqlから読める() -> None:
    assert {"categories", "articles", "users", "user_saves"} <= set(TABLES)


def test_backendとテストのSQLはテーブルにスキーマを付ける() -> None:
    files = sorted([*(ROOT / "backend").rglob("*.py"), *(ROOT / "tests").glob("test_db.py")])
    offenders = [
        f"{path.relative_to(ROOT)}: {match.group(0)}"
        for path in files
        if path not in EXCLUDED
        for match in UNQUALIFIED.finditer(path.read_text(encoding="utf-8"))
    ]
    assert offenders == []
