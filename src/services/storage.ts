import { AlertItem, AlertKeyword, AlertStateData, IAlertRepository } from '../types';
import { INITIAL_PRESET_KEYWORDS } from '../utils/alertUtils';

const STORAGE_KEYS = {
  KEYWORDS: 'alertpulse_keywords_v1',
  READ_IDS: 'alertpulse_read_ids_v1',
  FAVORITE_IDS: 'alertpulse_favorite_ids_v1',
  CACHED_ITEMS: 'alertpulse_cached_items_v1',
  LAST_SYNC: 'alertpulse_last_sync_v1',
};

/**
 * LocalStorage 実装の Repository
 * 将来的に Supabase や Firebase, Prisma 等に移行する際も、
 * この interface (IAlertRepository) を満たすクラスを差し替えるだけで動作します。
 */
export class LocalStorageAlertRepository implements IAlertRepository {
  async loadState(): Promise<AlertStateData> {
    try {
      if (typeof window === 'undefined') {
        return {
          keywords: INITIAL_PRESET_KEYWORDS,
          readIds: [],
          favoriteIds: [],
          cachedItems: [],
        };
      }

      const rawKeywords = localStorage.getItem(STORAGE_KEYS.KEYWORDS);
      const keywords: AlertKeyword[] = rawKeywords
        ? JSON.parse(rawKeywords)
        : INITIAL_PRESET_KEYWORDS;

      const rawReadIds = localStorage.getItem(STORAGE_KEYS.READ_IDS);
      const readIds: string[] = rawReadIds ? JSON.parse(rawReadIds) : [];

      const rawFavoriteIds = localStorage.getItem(STORAGE_KEYS.FAVORITE_IDS);
      const favoriteIds: string[] = rawFavoriteIds ? JSON.parse(rawFavoriteIds) : [];

      const rawCached = localStorage.getItem(STORAGE_KEYS.CACHED_ITEMS);
      const cachedItems: AlertItem[] = rawCached ? JSON.parse(rawCached) : [];

      const lastSyncTime = localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || undefined;

      return {
        keywords,
        readIds,
        favoriteIds,
        cachedItems,
        lastSyncTime,
      };
    } catch (e) {
      console.error('[StorageRepository] Failed to load state:', e);
      return {
        keywords: INITIAL_PRESET_KEYWORDS,
        readIds: [],
        favoriteIds: [],
        cachedItems: [],
      };
    }
  }

  async saveKeywords(keywords: AlertKeyword[]): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.KEYWORDS, JSON.stringify(keywords));
  }

  async markAsRead(idOrIds: string | string[], isRead: boolean): Promise<void> {
    if (typeof window === 'undefined') return;
    const rawReadIds = localStorage.getItem(STORAGE_KEYS.READ_IDS);
    let currentIds: string[] = rawReadIds ? JSON.parse(rawReadIds) : [];

    const targetIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    if (isRead) {
      const set = new Set([...currentIds, ...targetIds]);
      currentIds = Array.from(set);
    } else {
      const targetSet = new Set(targetIds);
      currentIds = currentIds.filter((id) => !targetSet.has(id));
    }

    localStorage.setItem(STORAGE_KEYS.READ_IDS, JSON.stringify(currentIds));
  }

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    if (typeof window === 'undefined') return;
    const rawFavoriteIds = localStorage.getItem(STORAGE_KEYS.FAVORITE_IDS);
    let currentIds: string[] = rawFavoriteIds ? JSON.parse(rawFavoriteIds) : [];

    if (isFavorite) {
      if (!currentIds.includes(id)) {
        currentIds.push(id);
      }
    } else {
      currentIds = currentIds.filter((item) => item !== id);
    }

    localStorage.setItem(STORAGE_KEYS.FAVORITE_IDS, JSON.stringify(currentIds));
  }

  async cacheFeedItems(items: AlertItem[]): Promise<void> {
    if (typeof window === 'undefined') return;
    // 最新100件程度をローカルキャッシュ
    const toCache = items.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.CACHED_ITEMS, JSON.stringify(toCache));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }
}

/**
 * 将来の Supabase / Cloud DB 移行用リファレンス実装（1行切り替え用）
 * 
 * export class SupabaseAlertRepository implements IAlertRepository {
 *   constructor(private supabaseClient: SupabaseClient) {}
 *   async loadState() {
 *     const { data: keywords } = await this.supabaseClient.from('keywords').select('*');
 *     const { data: reads } = await this.supabaseClient.from('alert_reads').select('item_id');
 *     const { data: favorites } = await this.supabaseClient.from('alert_favorites').select('item_id');
 *     ...
 *   }
 *   ...
 * }
 */

// デフォルトのリポジトリインスタンス（ここを1行差し替えるだけでDB連携可能）
export const defaultAlertRepository: IAlertRepository = new LocalStorageAlertRepository();
