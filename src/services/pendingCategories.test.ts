import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { savePendingCategories, takePendingCategories } from './pendingCategories';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('pendingCategories', () => {
  beforeEach(() => vi.stubGlobal('localStorage', createMemoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('保存したカテゴリを1回だけ取り出せる', () => {
    savePendingCategories(['ai', 'web3']);
    expect(takePendingCategories()).toEqual(['ai', 'web3']);
    expect(takePendingCategories()).toEqual([]);
  });

  it('空で保存すると消える', () => {
    savePendingCategories(['ai']);
    savePendingCategories([]);
    expect(takePendingCategories()).toEqual([]);
  });

  it('localStorage が使えなくても例外にしない', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => savePendingCategories(['ai'])).not.toThrow();
    expect(takePendingCategories()).toEqual([]);
  });
});
