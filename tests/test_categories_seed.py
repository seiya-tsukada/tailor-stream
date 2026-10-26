"""backend/feed/categories.py の SEED_CATEGORIES と supabase/seed.sql の一致を検証する"""

import re
from dataclasses import astuple
from pathlib import Path

from backend.feed.categories import SEED_CATEGORIES

SEED_SQL_PATH = Path(__file__).resolve().parent.parent / "supabase" / "seed.sql"
_SQL_VALUE = re.compile(r"'((?:[^']|'')*)'|\b(true|false|null)\b|(-?\d+)")
_VALUES_LINE = re.compile(r"^\s*\('")

SqlValue = str | int | bool | None


def _parse_value(match: re.Match[str]) -> SqlValue:
    text, literal, number = match.groups()
    if text is not None:
        return text.replace("''", "'")
    if literal is not None:
        return None if literal == "null" else literal == "true"
    return int(number)


def parse_seed_sql(sql: str) -> list[tuple[SqlValue, ...]]:
    """seed.sql の values 行（"  ('ai', ...)," 形式）を値のタプルに変換する"""
    return [
        tuple(_parse_value(m) for m in _SQL_VALUE.finditer(line))
        for line in sql.splitlines()
        if _VALUES_LINE.match(line)
    ]


def test_seed_sqlとカテゴリIDが一致する() -> None:
    rows = parse_seed_sql(SEED_SQL_PATH.read_text(encoding="utf-8"))
    assert [row[0] for row in rows] == [category.id for category in SEED_CATEGORIES]


def test_seed_sqlと全列の内容が一致する() -> None:
    rows = parse_seed_sql(SEED_SQL_PATH.read_text(encoding="utf-8"))
    assert rows == [astuple(category) for category in SEED_CATEGORIES]


def test_seed_sqlはtailor_streamスキーマに入れる() -> None:
    assert "insert into tailor_stream.categories" in SEED_SQL_PATH.read_text(encoding="utf-8")


def test_IDはslug形式で重複しない() -> None:
    ids = [category.id for category in SEED_CATEGORIES]
    assert len(set(ids)) == len(ids)
    assert all(re.fullmatch(r"[a-z0-9-]+", category_id) for category_id in ids)
