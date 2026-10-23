/**
 * ロジック側から表示するメッセージ（トースト・エラー）
 */

export const MESSAGES = {
  MARKED_ALL_READ: 'すべての未読記事を既読にしました',
  KEYWORD_ADDED: (keyword: string) => `「${keyword}」を追加しました`,
  KEYWORD_DELETED: (keyword: string) => `「${keyword}」を削除しました`,

  INIT_FAILED: '初期化に失敗しました',
  SERVER_ERROR: (status: number) => `サーバーエラー (${status})`,
  FEED_FETCH_FAILED: 'フィード取得に失敗しました',
  FEED_SYNC_FAILED: 'フィードの同期に失敗しました',

  FEED_TEST_SUCCESS: (title: string, itemCount: number) =>
    `接続成功: "${title}" (${itemCount}件の記事を確認)`,
  FEED_TEST_FAILED: 'フィードの取得に失敗しました',
  NETWORK_ERROR: 'ネットワーク接続エラーが発生しました',
} as const;
