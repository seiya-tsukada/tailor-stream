/**
 * クライアントアプリ全体で使う定数
 */

export const APP_INFO = {
  NAME: 'TailorStream',
  TAGLINE: '選んだカテゴリの「今読むべき」ニュース',
} as const;

export const API_PATHS = {
  CATEGORIES: '/api/categories',
  FEED: '/api/feed',
} as const;

export const LIMITS = {
  /** 一度に選べるカテゴリの最大数（サーバーの FEED_MAX_CATEGORIES と合わせる） */
  MAX_CATEGORIES: 3,
} as const;

/** 選択カテゴリを保持する URL クエリ（PR 2 でユーザー設定に移すまでの一時的な置き場所） */
export const URL_QUERY_KEYS = {
  CATEGORIES: 'categories',
} as const;

export const FAVICON_CONFIG = {
  ENDPOINT: 'https://www.google.com/s2/favicons',
  SIZE: 64,
} as const;

export const SKELETON_COUNT = 4;
