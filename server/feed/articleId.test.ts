import { describe, expect, it } from 'vitest';
import { createArticleId } from './articleId';

describe('createArticleId', () => {
  it('32文字の16進文字列を返す', () => {
    expect(createArticleId('https://example.com/a')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('正規化後に同じ URL なら同じ ID になる', () => {
    expect(createArticleId('https://Example.com/a/?utm_source=x#top')).toBe(createArticleId('https://example.com/a'));
  });

  it('同一ドメインの別記事は別の ID になる', () => {
    expect(createArticleId('https://example.com/articles/1')).not.toBe(createArticleId('https://example.com/articles/2'));
  });
});
