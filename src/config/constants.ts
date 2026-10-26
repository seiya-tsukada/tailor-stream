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
  AUTH_LOGIN_LINK: '/api/auth/login-link',
  AUTH_VERIFY: '/api/auth/verify',
  AUTH_LOGOUT: '/api/auth/logout',
  ME: '/api/me',
  ME_CATEGORIES: '/api/me/categories',
} as const;

/** フロントのページのパス（ログインリンクはサーバーの LOGIN_VERIFY_PATH と合わせる） */
export const PAGE_PATHS = {
  HOME: '/',
  AUTH_VERIFY: '/auth/verify',
} as const;

export const LIMITS = {
  /** 一度に選べるカテゴリの最大数（サーバーの FEED_MAX_CATEGORIES と合わせる） */
  MAX_CATEGORIES: 3,
} as const;

/** 未ログイン時の選択カテゴリを保持する URL クエリと、ログインリンクのトークン */
export const URL_QUERY_KEYS = {
  CATEGORIES: 'categories',
  TOKEN: 'token',
} as const;

/**
 * localStorage のキー
 * PENDING_CATEGORIES: ログインリンクを要求したときの選択カテゴリ。ログイン後、未設定ならアカウントへ移す
 */
export const STORAGE_KEYS = {
  PENDING_CATEGORIES: 'tailor_stream_pending_categories_v1',
} as const;

export const FAVICON_CONFIG = {
  ENDPOINT: 'https://www.google.com/s2/favicons',
  SIZE: 64,
} as const;

export const SKELETON_COUNT = 4;
