import { useCallback, useEffect, useState } from 'react';
import type { Me } from '../api/types';
import { MESSAGES } from '../config/messages';
import { fetchMyCategories, saveMyCategories } from '../services/apiClient';
import { takePendingCategories } from '../services/pendingCategories';
import { buildCategoryQuery, parseCategoryQuery } from '../utils/categoryQuery';
import { getErrorMessage } from '../utils/errors';

function writeQuery(ids: readonly string[]) {
  const { pathname, search, hash } = window.location;
  window.history.replaceState(null, '', `${pathname}${buildCategoryQuery(search, ids)}${hash}`);
}

/**
 * 選択カテゴリ
 * - 未ログイン: URL クエリ（?categories=...）に保持する
 * - ログイン中: アカウント（/api/me/categories）に保存する。
 *   アカウント側が未設定で、ログイン前に選んでいたカテゴリがあればそれを移す
 */
export function useCategorySelection(user: Me | null, isAuthReady: boolean) {
  const [selectedIds, setSelectedIdsState] = useState<string[]>(() => parseCategoryQuery(window.location.search));
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  // ログイン状態が決まったら、アカウントのカテゴリを読む
  useEffect(() => {
    if (!isAuthReady || userId === null) return;
    let cancelled = false;
    setIsSyncing(true);
    setError(null);
    (async () => {
      let ids = await fetchMyCategories();
      const pending = takePendingCategories();
      if (ids.length === 0 && pending.length > 0) ids = await saveMyCategories(pending);
      if (!cancelled) {
        setSelectedIdsState(ids);
        writeQuery([]);
      }
    })()
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, MESSAGES.CATEGORIES_FETCH_FAILED));
      })
      .finally(() => {
        if (!cancelled) setIsSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, userId]);

  // 未ログイン時はブラウザの戻る・進むで URL クエリが変わったら追従する
  useEffect(() => {
    if (userId !== null) return;
    const handlePopState = () => setSelectedIdsState(parseCategoryQuery(window.location.search));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [userId]);

  // ログアウトしたら選択をクリアする（アカウントの設定を URL に残さない）
  useEffect(() => {
    if (isAuthReady && userId === null) setSelectedIdsState(parseCategoryQuery(window.location.search));
  }, [isAuthReady, userId]);

  const setSelectedIds = useCallback(
    async (ids: string[]) => {
      if (userId === null) {
        setSelectedIdsState(ids);
        writeQuery(ids);
        return;
      }
      // 保存が終わってから反映する（フィードはサーバー側の設定で返るため）
      setIsSyncing(true);
      setError(null);
      try {
        setSelectedIdsState(await saveMyCategories(ids));
      } catch (err: unknown) {
        setError(getErrorMessage(err, MESSAGES.CATEGORIES_SAVE_FAILED));
      } finally {
        setIsSyncing(false);
      }
    },
    [userId]
  );

  return { selectedIds, setSelectedIds, isSyncing, error };
}
