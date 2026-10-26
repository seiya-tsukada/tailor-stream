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
  ACCOUNT: 'アカウント',
  BACK: '戻る',

  LOGIN_TITLE: 'ログイン / 登録',
  LOGIN_DESCRIPTION: 'メールアドレスにログイン用のリンクを送ります。ログインすると選んだカテゴリがアカウントに保存されます。',
  LOGIN_EMAIL_LABEL: 'メールアドレス',
  LOGIN_EMAIL_PLACEHOLDER: 'you@example.com',
  LOGIN_SUBMIT: 'ログインリンクを送る',
  LOGIN_SENDING: '送信中…',
  LOGIN_SENT_TITLE: 'メールを確認してください',
  LOGIN_SENT_DESCRIPTION: (email: string) =>
    `${email} にログイン用のリンクを送りました。リンクは15分間有効です。`,
  LOGIN_FAILED: 'ログインリンクの送信に失敗しました',
  LOGIN_PROMPT: 'ログインすると、選んだカテゴリをどの端末でも使えます',

  VERIFYING: 'ログインしています…',
  VERIFY_FAILED: 'ログインに失敗しました',
  VERIFY_SUCCESS: 'ログインしました',

  ACCOUNT_TITLE: 'アカウント',
  ACCOUNT_EMAIL: 'メールアドレス',
  ACCOUNT_PLAN: 'プラン',
  PLAN_NAMES: { free: '無料', pro: 'Pro' },
  LOGOUT: 'ログアウト',
  LOGOUT_FAILED: 'ログアウトに失敗しました',
  RETRY: '再試行',
  OPEN_ARTICLE: '記事を開く',

  CATEGORIES_FETCH_FAILED: 'カテゴリの取得に失敗しました',
  FEED_FETCH_FAILED: '記事の取得に失敗しました',
  CATEGORIES_SAVE_FAILED: 'カテゴリの保存に失敗しました',
  NETWORK_ERROR: 'ネットワーク接続エラーが発生しました',
  SERVER_ERROR: (status: number) => `サーバーエラー (${status})`,

  RELATIVE_TIME: {
    JUST_NOW: 'たった今',
    MINUTES_AGO: (n: number) => `${n}分前`,
    HOURS_AGO: (n: number) => `${n}時間前`,
    DAYS_AGO: (n: number) => `${n}日前`,
  },
} as const;
