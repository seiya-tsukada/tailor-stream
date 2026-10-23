export interface AlertItem {
  id: string;
  title: string;
  cleanTitle: string;
  summary: string;
  cleanSummary: string;
  originalUrl: string;
  googleUrl: string;
  publishedAt: string;
  domain: string;
  faviconUrl: string;
  keywordId: string;
  keywordName: string;
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

export interface FeedFetchResult {
  success: boolean;
  keywordId: string;
  keywordName: string;
  items: Omit<AlertItem, 'isRead' | 'isFavorite' | 'readAt' | 'favoriteAt'>[];
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type FeedFilterType = 'all' | 'unread' | 'favorites';

export type NavTabType = 'feed' | 'keywords' | 'favorites' | 'stats';

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
