import { useCallback, useEffect, useRef, useState } from 'react';
import type { Article } from '../api/types';
import { MESSAGES } from '../config/messages';
import { fetchFeed } from '../services/apiClient';
import { getErrorMessage } from '../utils/errors';

/**
 * 選択カテゴリの記事一覧。カテゴリかログイン状態が変わるたびに取り直す（古いリクエストの結果は捨てる）
 * enabled が false の間（ログイン状態の確認中など）は取得しない
 */
export function useFeed(categoryIds: readonly string[], userId: string | null, enabled: boolean) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const key = categoryIds.join(',');

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    const ids = key ? key.split(',') : [];
    if (!enabled || ids.length === 0) {
      setArticles([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const feed = await fetchFeed(ids);
      if (seq === requestSeq.current) setArticles(feed.articles);
    } catch (err: unknown) {
      if (seq === requestSeq.current) setError(getErrorMessage(err, MESSAGES.FEED_FETCH_FAILED));
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
    // userId はリクエストには使わないが、ログイン状態が変わったら取り直す
  }, [key, userId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { articles, isLoading, error, reload: load };
}
