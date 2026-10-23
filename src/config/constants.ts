/**
 * クライアントアプリ全体で使う定数
 */

export const APP_INFO = {
  NAME: 'AlertPulse',
  TAGLINE: 'Google Alerts Hub',
} as const;

/** localStorage のキー（変更すると既存ユーザーのデータが読めなくなるので注意） */
export const STORAGE_KEYS = {
  KEYWORDS: 'alertpulse_keywords_v1',
  READ_IDS: 'alertpulse_read_ids_v1',
  FAVORITE_IDS: 'alertpulse_favorite_ids_v1',
  CACHED_ITEMS: 'alertpulse_cached_items_v1',
  LAST_SYNC: 'alertpulse_last_sync_v1',
} as const;

export const LIMITS = {
  /** localStorage にキャッシュする記事の最大件数 */
  CACHED_ITEMS: 100,
  /** バッジに表示する最大数（超えると "99+"） */
  BADGE_MAX: 99,
} as const;

export const UI_TIMING = {
  TOAST_DURATION_MS: 2500,
  COPY_FEEDBACK_MS: 2000,
} as const;

export const EXPORT_CONFIG = {
  VERSION: '1.0.0',
  FILE_PREFIX: 'alertpulse_backup_',
} as const;

export const EXTERNAL_LINKS = {
  GOOGLE_ALERTS: 'https://www.google.co.jp/alerts',
  GOOGLE_ALERTS_CREATE: 'https://www.google.co.jp/alerts#create:q=',
  GOOGLE_ALERTS_FEED_PLACEHOLDER: 'https://www.google.co.jp/alerts/feeds/...',
} as const;
