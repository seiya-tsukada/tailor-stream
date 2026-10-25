import 'dotenv/config';

/**
 * サーバー設定
 * 環境変数で上書き可能な値と、固定の定数をまとめて管理する
 */

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const SERVER_CONFIG = {
  PORT: readNumberEnv('PORT', 3000),
  HOST: process.env.HOST || '0.0.0.0',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  DIST_DIR: 'dist',
  APP_NAME: 'AlertPulse',
} as const;

export const RSS_CONFIG = {
  TIMEOUT_MS: readNumberEnv('RSS_TIMEOUT_MS', 10000),
  USER_AGENT:
    process.env.RSS_USER_AGENT ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ACCEPT: 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
} as const;

export const FEED_DEFAULTS = {
  KEYWORD: 'Google Alert',
  KEYWORD_ID: 'default-kw',
  UNTITLED_ARTICLE: '無題の記事',
  FEED_TITLE: 'Google Alert Feed',
  /** URL 検証時に返すプレビュー件数 */
  VALIDATE_PREVIEW_COUNT: 3,
  /** 記事 ID に使う SHA-256 16進文字列の長さ */
  ARTICLE_ID_LENGTH: 32,
} as const;

export const SERVER_MESSAGES = {
  FEED_FETCH_FAILED: 'フィードの取得に失敗しました',
  BATCH_FETCH_FAILED: '一括フィード取得に失敗しました',
  URL_REQUIRED: 'URLが指定されていません',
  FEED_PARSE_FAILED: 'フィードの解析に失敗しました',
  INVALID_URL: 'URLが無効です',
} as const;
