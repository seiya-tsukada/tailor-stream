import { LIMITS, URL_QUERY_KEYS } from '../config/constants';

/** カンマ区切りのカテゴリ ID を、空要素・重複を除いて最大件数で切る */
export function parseCategoryIds(raw: string, max: number = LIMITS.MAX_CATEGORIES): string[] {
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return [...new Set(ids)].slice(0, max);
}

/** URL クエリ（?categories=ai,web3）から選択カテゴリを読む */
export function parseCategoryQuery(search: string, max: number = LIMITS.MAX_CATEGORIES): string[] {
  return parseCategoryIds(new URLSearchParams(search).get(URL_QUERY_KEYS.CATEGORIES) ?? '', max);
}

/** 選択カテゴリを URL クエリに書き戻す（他のクエリは残す。空なら categories を消す） */
export function buildCategoryQuery(search: string, categoryIds: readonly string[]): string {
  const params = new URLSearchParams(search);
  if (categoryIds.length > 0) {
    params.set(URL_QUERY_KEYS.CATEGORIES, categoryIds.join(','));
  } else {
    params.delete(URL_QUERY_KEYS.CATEGORIES);
  }
  const query = params.toString().replace(/%2C/g, ',');
  return query ? `?${query}` : '';
}

/** カテゴリの選択を切り替える。上限に達しているときに追加しようとした場合は null を返す */
export function toggleCategory(
  selected: readonly string[],
  categoryId: string,
  max: number = LIMITS.MAX_CATEGORIES
): string[] | null {
  if (selected.includes(categoryId)) return selected.filter((id) => id !== categoryId);
  if (selected.length >= max) return null;
  return [...selected, categoryId];
}
