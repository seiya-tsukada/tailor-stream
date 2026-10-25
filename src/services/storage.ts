import { AlertItem, AlertKeyword, AlertStateData, IAlertRepository } from '../types';
import { LIMITS, STORAGE_KEYS } from '../config/constants';
import { INITIAL_PRESET_KEYWORDS } from '../config/keywords';

const isBrowser = () => typeof window !== 'undefined';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

// 要素は id など主要フィールドのみ確認する（全フィールドの厳密な検証はしない）
const isKeywordArray = (value: unknown): value is AlertKeyword[] =>
  Array.isArray(value) &&
  value.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.keyword === 'string');

const isAlertItemArray = (value: unknown): value is AlertItem[] =>
  Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === 'string');

/**
 * localStorage から JSON を読む。
 * 未保存・JSON として壊れている・期待する形でない場合は、そのキーだけ fallback を返す。
 */
function readJson<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return parsed;
    console.warn(`[StorageRepository] Unexpected value for "${key}", using fallback.`);
  } catch (e) {
    console.warn(`[StorageRepository] Failed to parse "${key}", using fallback:`, e);
  }
  return fallback;
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
        keywords: readJson(STORAGE_KEYS.KEYWORDS, INITIAL_PRESET_KEYWORDS, isKeywordArray),
        readIds: readJson(STORAGE_KEYS.READ_IDS, [], isStringArray),
        favoriteIds: readJson(STORAGE_KEYS.FAVORITE_IDS, [], isStringArray),
        cachedItems: readJson(STORAGE_KEYS.CACHED_ITEMS, [], isAlertItemArray),
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
    const currentIds = readJson(STORAGE_KEYS.READ_IDS, [], isStringArray);
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
    const currentIds = readJson(STORAGE_KEYS.FAVORITE_IDS, [], isStringArray);

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
