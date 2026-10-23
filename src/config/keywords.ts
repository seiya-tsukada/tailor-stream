import { AlertKeyword } from '../types';

/**
 * キーワード（タグ）関連の設定
 */

export const DEFAULT_KEYWORD_COLOR = '#3B82F6';

/** キーワード設定画面で選択できるタグカラー */
export const KEYWORD_COLOR_PALETTE = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Indigo', hex: '#6366F1' },
] as const;

/** 色が指定されなかった場合に登録順で割り当てるカラー */
export const KEYWORD_AUTO_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
] as const;

// プリセットサンプルキーワード（初回起動時）
export const INITIAL_PRESET_KEYWORDS: AlertKeyword[] = [
  {
    id: 'kw-ai-agents',
    keyword: 'AI エージェント',
    feedUrl: '',
    isActive: true,
    color: '#3B82F6', // Blue
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kw-nextjs',
    keyword: 'Next.js React',
    feedUrl: '',
    isActive: true,
    color: '#10B981', // Emerald
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kw-tech-trends',
    keyword: '生成AI スタートアップ',
    feedUrl: '',
    isActive: true,
    color: '#8B5CF6', // Purple
    createdAt: new Date().toISOString(),
  },
];
