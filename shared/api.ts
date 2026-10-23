/**
 * クライアント・サーバー共通の API 定義
 */

export const API_ROUTES = {
  FEED: '/api/feed',
  FEED_BATCH: '/api/feed/batch',
  FEED_VALIDATE: '/api/feed/validate',
  HEALTH: '/api/health',
} as const;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** サーバーが返す整形済み記事（既読・お気に入り状態を含まない） */
export interface FeedItemPayload {
  id: string;
  title: string;
  cleanTitle: string;
  summary: string;
  cleanSummary: string;
  originalUrl: string;
  googleUrl: string;
  publishedAt: string;
  domain: string;
  faviconUrl: string;
  keywordId: string;
  keywordName: string;
}

/** バッチ取得リクエストで送るキーワード情報 */
export interface FeedKeywordPayload {
  id: string;
  keyword: string;
  feedUrl?: string;
  isActive?: boolean;
}

export interface FeedFetchResult {
  success: boolean;
  keywordId: string;
  keywordName: string;
  items: FeedItemPayload[];
  isSample?: boolean;
  error?: string;
}

export interface FeedBatchResponseData {
  results: FeedFetchResult[];
  items: FeedItemPayload[];
  totalCount: number;
}

export interface FeedValidateResponseData {
  title: string;
  description: string;
  itemCount: number;
  previewItems: Array<{ title: string; originalUrl: string; domain: string }>;
}
