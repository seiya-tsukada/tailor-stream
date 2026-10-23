import { EXTERNAL_LINKS } from '../config/constants';

// 相対日時のフォーマット（例: "3分前", "2時間前", "昨日", "2026/08/25"）
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'たった今';
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}分前`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}時間前`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}日前`;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (year === now.getFullYear()) {
      return `${month}/${day}`;
    }
    return `${year}/${month}/${day}`;
  } catch {
    return dateString;
  }
}

// キーワードから Google アラートの作成ページURLを生成
export function createGoogleAlertsWebUrl(keyword: string): string {
  return `${EXTERNAL_LINKS.GOOGLE_ALERTS_CREATE}${encodeURIComponent(keyword)}`;
}

// 記事を Web Share API で共有。非対応ブラウザでは fallback を実行する
export async function shareArticle(
  item: { cleanTitle: string; cleanSummary: string; originalUrl: string },
  fallback: () => void
): Promise<void> {
  if (!navigator.share) {
    fallback();
    return;
  }
  try {
    await navigator.share({
      title: item.cleanTitle,
      text: item.cleanSummary,
      url: item.originalUrl,
    });
  } catch {
    // 共有がキャンセルされた
  }
}
