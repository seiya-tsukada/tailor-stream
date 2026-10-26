import { describe, expect, it } from 'vitest';
import { buildCategoryQuery, parseCategoryQuery, toggleCategory } from './categoryQuery';

describe('parseCategoryQuery', () => {
  it('カンマ区切りの ID を空要素・重複を除いて返す', () => {
    expect(parseCategoryQuery('?categories=ai,%20web3,,ai')).toEqual(['ai', 'web3']);
  });

  it('最大件数を超えた分は切り捨てる', () => {
    expect(parseCategoryQuery('?categories=a,b,c,d', 3)).toEqual(['a', 'b', 'c']);
  });

  it('クエリが無ければ空配列', () => {
    expect(parseCategoryQuery('')).toEqual([]);
  });
});

describe('buildCategoryQuery', () => {
  it('他のクエリを残して categories を書き換える', () => {
    expect(buildCategoryQuery('?x=1&categories=ai', ['ai', 'web3'])).toBe('?x=1&categories=ai,web3');
  });

  it('空なら categories を消す', () => {
    expect(buildCategoryQuery('?categories=ai', [])).toBe('');
  });
});

describe('toggleCategory', () => {
  it('未選択なら追加し、選択済みなら外す', () => {
    expect(toggleCategory(['ai'], 'web3')).toEqual(['ai', 'web3']);
    expect(toggleCategory(['ai', 'web3'], 'ai')).toEqual(['web3']);
  });

  it('上限に達していると追加できず null を返す', () => {
    expect(toggleCategory(['a', 'b', 'c'], 'd', 3)).toBeNull();
    expect(toggleCategory(['a', 'b', 'c'], 'a', 3)).toEqual(['b', 'c']);
  });
});
