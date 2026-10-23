import type { FeedItemPayload } from '../shared/api';

export type { ApiResponse, FeedFetchResult } from '../shared/api';

export interface AlertItem extends FeedItemPayload {
  isRead: boolean;
  isFavorite: boolean;
  readAt?: string;
  favoriteAt?: string;
}

export interface AlertKeyword {
  id: string;
  keyword: string;
  feedUrl: string;
  isActive: boolean;
  color: string;
  createdAt: string;
  lastFetchedAt?: string;
  unreadCount?: number;
  totalCount?: number;
}

export type FeedFilterType = 'all' | 'unread' | 'favorites';

export type NavTabType = 'feed' | 'keywords' | 'favorites' | 'stats';

export interface KeywordCount {
  total: number;
  unread: number;
}

export interface FeedStats {
  total: number;
  unread: number;
  favorites: number;
  keywordCounts: Record<string, KeywordCount>;
}

export interface AlertStateData {
  readIds: string[];
  favoriteIds: string[];
  keywords: AlertKeyword[];
  cachedItems: AlertItem[];
  lastSyncTime?: string;
}

export interface IAlertRepository {
  loadState(): Promise<AlertStateData>;
  saveKeywords(keywords: AlertKeyword[]): Promise<void>;
  markAsRead(id: string | string[], isRead: boolean): Promise<void>;
  toggleFavorite(id: string, isFavorite: boolean): Promise<void>;
  cacheFeedItems(items: AlertItem[]): Promise<void>;
}
