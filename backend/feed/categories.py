"""カテゴリの定義

SEED_CATEGORIES は仮のシード（docs/SPEC.md §9: 確定後に差し替える）。
supabase/seed.sql と内容を一致させること（tests/test_categories_seed.py で検証している）。
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    id: str
    name_ja: str
    name_en: str
    description: str | None
    sort_order: int
    is_active: bool


SEED_CATEGORIES: tuple[Category, ...] = (
    Category("ai", "AI", "AI", "生成AI・機械学習・AIエージェントの動向", 10, True),
    Category(
        "web3",
        "Web3・暗号資産",
        "Web3 & Crypto",
        "ブロックチェーン・暗号資産・ステーブルコイン",
        20,
        True,
    ),
    Category("startup", "スタートアップ", "Startups", "資金調達・新規事業・起業家", 30, True),
    Category("fintech", "フィンテック", "Fintech", "決済・金融サービス・規制の動き", 40, True),
    Category(
        "security", "セキュリティ", "Security", "脆弱性・サイバー攻撃・プライバシー", 50, True
    ),
    Category(
        "devtools",
        "開発者ツール",
        "Developer Tools",
        "プログラミング言語・フレームワーク・開発基盤",
        60,
        True,
    ),
    Category(
        "marketing", "マーケティング", "Marketing", "デジタル広告・SNS・ブランド戦略", 70, True
    ),
    Category("economy", "経済・マーケット", "Economy & Markets", "景気・金利・株式市場", 80, True),
)
