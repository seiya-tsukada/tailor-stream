-- 仮カテゴリのシード（docs/SPEC.md §9: 確定後に差し替える）
-- backend/feed/categories.py と内容を一致させること（tests/test_categories_seed.py で検証している）
insert into tailor_stream.categories (id, name_ja, name_en, description, sort_order, is_active) values
  ('ai', 'AI', 'AI', '生成AI・機械学習・AIエージェントの動向', 10, true),
  ('web3', 'Web3・暗号資産', 'Web3 & Crypto', 'ブロックチェーン・暗号資産・ステーブルコイン', 20, true),
  ('startup', 'スタートアップ', 'Startups', '資金調達・新規事業・起業家', 30, true),
  ('fintech', 'フィンテック', 'Fintech', '決済・金融サービス・規制の動き', 40, true),
  ('security', 'セキュリティ', 'Security', '脆弱性・サイバー攻撃・プライバシー', 50, true),
  ('devtools', '開発者ツール', 'Developer Tools', 'プログラミング言語・フレームワーク・開発基盤', 60, true),
  ('marketing', 'マーケティング', 'Marketing', 'デジタル広告・SNS・ブランド戦略', 70, true),
  ('economy', '経済・マーケット', 'Economy & Markets', '景気・金利・株式市場', 80, true)
on conflict (id) do update set
  name_ja = excluded.name_ja,
  name_en = excluded.name_en,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
