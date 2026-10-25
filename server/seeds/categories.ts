import type { Category } from '../../shared/domain';

/**
 * 仮カテゴリのシード（docs/SPEC.md §9: 確定後に差し替える）
 * supabase/seed.sql と内容を一致させること（categories.test.ts で検証している）。
 * モック実装はこの値を使う。
 */
export const SEED_CATEGORIES: readonly Category[] = [
  { id: 'ai', nameJa: 'AI', nameEn: 'AI', description: '生成AI・機械学習・AIエージェントの動向', sortOrder: 10, isActive: true },
  { id: 'web3', nameJa: 'Web3・暗号資産', nameEn: 'Web3 & Crypto', description: 'ブロックチェーン・暗号資産・ステーブルコイン', sortOrder: 20, isActive: true },
  { id: 'startup', nameJa: 'スタートアップ', nameEn: 'Startups', description: '資金調達・新規事業・起業家', sortOrder: 30, isActive: true },
  { id: 'fintech', nameJa: 'フィンテック', nameEn: 'Fintech', description: '決済・金融サービス・規制の動き', sortOrder: 40, isActive: true },
  { id: 'security', nameJa: 'セキュリティ', nameEn: 'Security', description: '脆弱性・サイバー攻撃・プライバシー', sortOrder: 50, isActive: true },
  { id: 'devtools', nameJa: '開発者ツール', nameEn: 'Developer Tools', description: 'プログラミング言語・フレームワーク・開発基盤', sortOrder: 60, isActive: true },
  { id: 'marketing', nameJa: 'マーケティング', nameEn: 'Marketing', description: 'デジタル広告・SNS・ブランド戦略', sortOrder: 70, isActive: true },
  { id: 'economy', nameJa: '経済・マーケット', nameEn: 'Economy & Markets', description: '景気・金利・株式市場', sortOrder: 80, isActive: true },
];
