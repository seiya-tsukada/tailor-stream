import { useCallback, useEffect, useState } from 'react';
import { buildCategoryQuery, parseCategoryQuery } from '../utils/categoryQuery';

/**
 * 選択カテゴリを URL クエリ（?categories=...）と同期して持つ
 * PR 2 でユーザー設定（/api/me/categories）に置き換える
 */
export function useCategorySelection() {
  const [selectedIds, setSelectedIdsState] = useState<string[]>(() => parseCategoryQuery(window.location.search));

  useEffect(() => {
    const handlePopState = () => setSelectedIdsState(parseCategoryQuery(window.location.search));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedIdsState(ids);
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${buildCategoryQuery(search, ids)}${hash}`);
  }, []);

  return { selectedIds, setSelectedIds };
}
