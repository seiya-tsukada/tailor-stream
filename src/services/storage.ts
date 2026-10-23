import { AlertItem, AlertKeyword, AlertStateData, IAlertRepository } from '../types';
import { LIMITS, STORAGE_KEYS } from '../config/constants';
import { INITIAL_PRESET_KEYWORDS } from '../config/keywords';

const isBrowser = () => typeof window !== 'undefined';

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const createInitialState = (): AlertStateData => ({
  keywords: INITIAL_PRESET_KEYWORDS,
  readIds: [],
  favoriteIds: [],
  cachedItems: [],
});

/**
 * LocalStorage 実装の Repository
 * 別の永続化先に移行する場合は IAlertRepository を満たすクラスを用意し、
 * defaultAlertRepository を差し替える。
 */
export class LocalStorageAlertRepository implements IAlertRepository {
  async loadState(): Promise<AlertStateData> {
    try {
      if (!isBrowser()) return createInitialState();

      return {
        keywords: readJson<AlertKeyword[]>(STORAGE_KEYS.KEYWORDS, INITIAL_PRESET_KEYWORDS),
        readIds: readJson<string[]>(STORAGE_KEYS.READ_IDS, []),
        favoriteIds: readJson<string[]>(STORAGE_KEYS.FAVORITE_IDS, []),
        cachedItems: readJson<AlertItem[]>(STORAGE_KEYS.CACHED_ITEMS, []),
        lastSyncTime: localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || undefined,
      };
    } catch (e) {
      console.error('[StorageRepository] Failed to load state:', e);
      return createInitialState();
    }
  }

  async saveKeywords(keywords: AlertKeyword[]): Promise<void> {
    if (!isBrowser()) return;
    writeJson(STORAGE_KEYS.KEYWORDS, keywords);
  }

  async markAsRead(idOrIds: string | string[], isRead: boolean): Promise<void> {
    if (!isBrowser()) return;
    const currentIds = readJson<string[]>(STORAGE_KEYS.READ_IDS, []);
    const targetIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    let nextIds: string[];
    if (isRead) {
      nextIds = Array.from(new Set([...currentIds, ...targetIds]));
    } else {
      const targetSet = new Set(targetIds);
      nextIds = currentIds.filter((id) => !targetSet.has(id));
    }

    writeJson(STORAGE_KEYS.READ_IDS, nextIds);
  }

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    if (!isBrowser()) return;
    const currentIds = readJson<string[]>(STORAGE_KEYS.FAVORITE_IDS, []);

    let nextIds = currentIds;
    if (isFavorite) {
      if (!currentIds.includes(id)) nextIds = [...currentIds, id];
    } else {
      nextIds = currentIds.filter((item) => item !== id);
    }

    writeJson(STORAGE_KEYS.FAVORITE_IDS, nextIds);
  }

  async cacheFeedItems(items: AlertItem[]): Promise<void> {
    if (!isBrowser()) return;
    writeJson(STORAGE_KEYS.CACHED_ITEMS, items.slice(0, LIMITS.CACHED_ITEMS));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }
}

// デフォルトのリポジトリインスタンス
export const defaultAlertRepository: IAlertRepository = new LocalStorageAlertRepository();
