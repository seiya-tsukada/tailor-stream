import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertItem,
  AlertKeyword,
  FeedFilterType,
  IAlertRepository,
  NavTabType,
} from '../types';
import { defaultAlertRepository } from '../services/storage';

interface UseAlertStateOptions {
  repository?: IAlertRepository;
  autoFetchOnMount?: boolean;
}

export function useAlertState(options: UseAlertStateOptions = {}) {
  const repository = options.repository || defaultAlertRepository;

  // 永続化状態
  const [keywords, setKeywords] = useState<AlertKeyword[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  
  // フィードアイテム＆通信状態
  const [items, setItems] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // UI フィルタ・タブ・検索状態
  const [activeTab, setActiveTab] = useState<NavTabType>('feed');
  const [filterType, setFilterType] = useState<FeedFilterType>('all');
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. 初回ロード（Repositoryから状態を取得）
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setIsLoading(true);
        const state = await repository.loadState();
        if (!isMounted) return;

        setKeywords(state.keywords);
        setReadIds(new Set(state.readIds));
        setFavoriteIds(new Set(state.favoriteIds));

        if (state.cachedItems && state.cachedItems.length > 0) {
          // キャッシュされたアイテムに最新の読了/お気に入りフラグをマッピング
          const mapped = state.cachedItems.map((item) => ({
            ...item,
            isRead: state.readIds.includes(item.id),
            isFavorite: state.favoriteIds.includes(item.id),
          }));
          setItems(mapped);
        }
        if (state.lastSyncTime) {
          setLastSyncTime(state.lastSyncTime);
        }

        // 初期フィード取得
        if (options.autoFetchOnMount !== false && state.keywords.length > 0) {
          await fetchFeeds(state.keywords, new Set(state.readIds), new Set(state.favoriteIds));
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || '初期化に失敗しました');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. フィードの一括取得APIリクエスト
  const fetchFeeds = useCallback(
    async (
      currentKeywords: AlertKeyword[] = keywords,
      currentReads: Set<string> = readIds,
      currentFavs: Set<string> = favoriteIds
    ) => {
      const activeKw = currentKeywords.filter((k) => k.isActive);
      if (activeKw.length === 0) {
        setItems([]);
        setIsRefreshing(false);
        return;
      }

      setIsRefreshing(true);
      setError(null);

      try {
        const response = await fetch('/api/feed/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: activeKw }),
        });

        if (!response.ok) {
          throw new Error(`サーバーエラー (${response.status})`);
        }

        const json = await response.json();
        if (json.success && json.data?.items) {
          const rawItems = json.data.items as AlertItem[];

          // 既読・お気に入り状態をマージ
          const enriched: AlertItem[] = rawItems.map((item) => ({
            ...item,
            isRead: currentReads.has(item.id),
            isFavorite: currentFavs.has(item.id),
          }));

          setItems(enriched);
          const syncNow = new Date().toISOString();
          setLastSyncTime(syncNow);

          // リポジトリへキャッシュ保存
          await repository.cacheFeedItems(enriched);
        } else {
          throw new Error(json.error || 'フィード取得に失敗しました');
        }
      } catch (err: any) {
        console.error('[useAlertState] Feed fetch failed:', err);
        setError(err.message || 'フィードの同期に失敗しました');
      } finally {
        setIsRefreshing(false);
      }
    },
    [keywords, readIds, favoriteIds, repository]
  );

  // 3. 既読状態の操作
  const markAsRead = useCallback(
    async (id: string, isRead: boolean = true) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        if (isRead) next.add(id);
        else next.delete(id);
        return next;
      });

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead } : item))
      );

      await repository.markAsRead(id, isRead);
    },
    [repository]
  );

  // 一括既読化（表示中の未読すべて、または全体）
  const markAllAsRead = useCallback(
    async (targetKeywordId?: string | null) => {
      const targetItems = items.filter((item) => {
        if (item.isRead) return false;
        if (targetKeywordId) return item.keywordId === targetKeywordId;
        return true;
      });

      if (targetItems.length === 0) return;

      const idsToMark = targetItems.map((i) => i.id);

      setReadIds((prev) => {
        const next = new Set(prev);
        idsToMark.forEach((id) => next.add(id));
        return next;
      });

      setItems((prev) =>
        prev.map((item) =>
          idsToMark.includes(item.id) ? { ...item, isRead: true } : item
        )
      );

      await repository.markAsRead(idsToMark, true);
    },
    [items, repository]
  );

  // 4. お気に入り（保存）の切り替え
  const toggleFavorite = useCallback(
    async (id: string) => {
      const willBeFav = !favoriteIds.has(id);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (willBeFav) next.add(id);
        else next.delete(id);
        return next;
      });

      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isFavorite: willBeFav } : item
        )
      );

      await repository.toggleFavorite(id, willBeFav);
    },
    [favoriteIds, repository]
  );

  // 5. キーワードの追加・更新・削除
  const addKeyword = useCallback(
    async (keywordStr: string, feedUrl: string = '', color?: string) => {
      const trimmed = keywordStr.trim();
      if (!trimmed) return;

      const defaultColors = [
        '#3B82F6', // Blue
        '#10B981', // Emerald
        '#8B5CF6', // Purple
        '#F59E0B', // Amber
        '#EC4899', // Pink
        '#06B6D4', // Cyan
        '#F97316', // Orange
      ];
      const assignedColor =
        color || defaultColors[keywords.length % defaultColors.length];

      const newKeyword: AlertKeyword = {
        id: `kw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        keyword: trimmed,
        feedUrl: feedUrl.trim(),
        isActive: true,
        color: assignedColor,
        createdAt: new Date().toISOString(),
      };

      const updatedKeywords = [...keywords, newKeyword];
      setKeywords(updatedKeywords);
      await repository.saveKeywords(updatedKeywords);

      // 自動で再取得
      await fetchFeeds(updatedKeywords, readIds, favoriteIds);
    },
    [keywords, readIds, favoriteIds, repository, fetchFeeds]
  );

  const updateKeyword = useCallback(
    async (id: string, updates: Partial<AlertKeyword>) => {
      const updatedKeywords = keywords.map((k) =>
        k.id === id ? { ...k, ...updates } : k
      );
      setKeywords(updatedKeywords);
      await repository.saveKeywords(updatedKeywords);

      if (updates.feedUrl !== undefined || updates.isActive !== undefined || updates.keyword !== undefined) {
        await fetchFeeds(updatedKeywords, readIds, favoriteIds);
      }
    },
    [keywords, readIds, favoriteIds, repository, fetchFeeds]
  );

  const deleteKeyword = useCallback(
    async (id: string) => {
      const updatedKeywords = keywords.filter((k) => k.id !== id);
      setKeywords(updatedKeywords);
      if (selectedKeywordId === id) {
        setSelectedKeywordId(null);
      }
      await repository.saveKeywords(updatedKeywords);
      await fetchFeeds(updatedKeywords, readIds, favoriteIds);
    },
    [keywords, selectedKeywordId, readIds, favoriteIds, repository, fetchFeeds]
  );

  const toggleKeywordActive = useCallback(
    async (id: string) => {
      const target = keywords.find((k) => k.id === id);
      if (!target) return;
      await updateKeyword(id, { isActive: !target.isActive });
    },
    [keywords, updateKeyword]
  );

  // 6. フィルタリング＆検索結果の計算
  const filteredItems = useMemo(() => {
    let result = items;

    // タブによるフィルタ（お気に入りタブの場合）
    if (activeTab === 'favorites') {
      result = result.filter((item) => item.isFavorite);
    } else if (filterType === 'unread') {
      result = result.filter((item) => !item.isRead);
    } else if (filterType === 'favorites') {
      result = result.filter((item) => item.isFavorite);
    }

    // キーワード選択フィルタ
    if (selectedKeywordId) {
      result = result.filter((item) => item.keywordId === selectedKeywordId);
    }

    // 検索語句フィルタ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.cleanTitle.toLowerCase().includes(query) ||
          item.cleanSummary.toLowerCase().includes(query) ||
          item.domain.toLowerCase().includes(query) ||
          item.keywordName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [items, activeTab, filterType, selectedKeywordId, searchQuery]);

  // 統計情報
  const stats = useMemo(() => {
    const total = items.length;
    const unread = items.filter((i) => !i.isRead).length;
    const favorites = items.filter((i) => i.isFavorite).length;

    const keywordCounts: Record<string, { total: number; unread: number }> = {};
    keywords.forEach((kw) => {
      const kwItems = items.filter((i) => i.keywordId === kw.id);
      keywordCounts[kw.id] = {
        total: kwItems.length,
        unread: kwItems.filter((i) => !i.isRead).length,
      };
    });

    return {
      total,
      unread,
      favorites,
      keywordCounts,
    };
  }, [items, keywords]);

  return {
    // 状態
    keywords,
    items,
    filteredItems,
    isLoading,
    isRefreshing,
    error,
    lastSyncTime,
    stats,
    // ナビ・フィルタ状態
    activeTab,
    setActiveTab,
    filterType,
    setFilterType,
    selectedKeywordId,
    setSelectedKeywordId,
    searchQuery,
    setSearchQuery,
    // アクション
    fetchFeeds,
    markAsRead,
    markAllAsRead,
    toggleFavorite,
    addKeyword,
    updateKeyword,
    deleteKeyword,
    toggleKeywordActive,
  };
}
