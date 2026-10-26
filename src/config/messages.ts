/**
 * UI に出す文言
 */

export const MESSAGES = {
  CATEGORY_PICKER_TITLE: 'カテゴリを選ぶ',
  CATEGORY_PICKER_HINT: (max: number) => `最大${max}つまで選べます`,
  CATEGORY_LIMIT_REACHED: (max: number) => `選べるのは${max}つまでです`,

  FEED_EMPTY_NO_CATEGORY_TITLE: 'カテゴリを選んでください',
  FEED_EMPTY_NO_CATEGORY_DESCRIPTION: '上のカテゴリから気になる分野を選ぶと、ニュースがここに並びます。',
  FEED_EMPTY_TITLE: '表示できる記事がありません',
  FEED_EMPTY_DESCRIPTION: '記事はまだ取り込まれていません。しばらくしてから再度お試しください。',

  REFRESH: '更新',
  RETRY: '再試行',
  OPEN_ARTICLE: '記事を開く',

  CATEGORIES_FETCH_FAILED: 'カテゴリの取得に失敗しました',
  FEED_FETCH_FAILED: '記事の取得に失敗しました',
  NETWORK_ERROR: 'ネットワーク接続エラーが発生しました',
  SERVER_ERROR: (status: number) => `サーバーエラー (${status})`,

  RELATIVE_TIME: {
    JUST_NOW: 'たった今',
    MINUTES_AGO: (n: number) => `${n}分前`,
    HOURS_AGO: (n: number) => `${n}時間前`,
    DAYS_AGO: (n: number) => `${n}日前`,
  },
} as const;
