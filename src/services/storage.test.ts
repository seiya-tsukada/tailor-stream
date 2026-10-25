import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../config/constants';
import { INITIAL_PRESET_KEYWORDS } from '../config/keywords';
import { LocalStorageAlertRepository } from './storage';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

describe('LocalStorageAlertRepository.loadState', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('壊れた JSON のキーだけフォールバックし、他のキーは読み込む', async () => {
    localStorage.setItem(STORAGE_KEYS.READ_IDS, '{not json');
    localStorage.setItem(STORAGE_KEYS.FAVORITE_IDS, JSON.stringify(['fav-1']));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, '2026-10-25T00:00:00.000Z');

    const state = await new LocalStorageAlertRepository().loadState();

    expect(state.readIds).toEqual([]);
    expect(state.favoriteIds).toEqual(['fav-1']);
    expect(state.keywords).toEqual(INITIAL_PRESET_KEYWORDS);
    expect(state.lastSyncTime).toBe('2026-10-25T00:00:00.000Z');
  });

  it('JSON として正しくても形が違う値はフォールバックする', async () => {
    localStorage.setItem(STORAGE_KEYS.KEYWORDS, JSON.stringify({ id: 'kw' }));
    localStorage.setItem(STORAGE_KEYS.READ_IDS, JSON.stringify([1, 2]));
    localStorage.setItem(STORAGE_KEYS.FAVORITE_IDS, JSON.stringify(['fav-1']));

    const state = await new LocalStorageAlertRepository().loadState();

    expect(state.keywords).toEqual(INITIAL_PRESET_KEYWORDS);
    expect(state.readIds).toEqual([]);
    expect(state.favoriteIds).toEqual(['fav-1']);
  });

  it('既読 ID が壊れていても markAsRead で上書きできる', async () => {
    localStorage.setItem(STORAGE_KEYS.READ_IDS, 'broken');
    const repository = new LocalStorageAlertRepository();

    await repository.markAsRead('item-1', true);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.READ_IDS) ?? '')).toEqual(['item-1']);
  });
});
