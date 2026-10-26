import { STORAGE_KEYS } from '../config/constants';
import { parseCategoryIds } from '../utils/categoryQuery';

/**
 * 未ログインで選んでいたカテゴリを、ログインリンクの要求からログイン完了までの間だけ保持する
 * （メールのリンクは別タブで開かれることが多く、URL クエリは引き継がれないため localStorage を使う）
 * localStorage が使えない環境では何もしない。
 */
export function savePendingCategories(categoryIds: readonly string[]): void {
  try {
    if (categoryIds.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PENDING_CATEGORIES, categoryIds.join(','));
    } else {
      localStorage.removeItem(STORAGE_KEYS.PENDING_CATEGORIES);
    }
  } catch {
    // 保存できなくてもログイン自体は続けられる
  }
}

/** 保持していたカテゴリを取り出して消す */
export function takePendingCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.PENDING_CATEGORIES);
    return raw ? parseCategoryIds(raw) : [];
  } catch {
    return [];
  }
}
