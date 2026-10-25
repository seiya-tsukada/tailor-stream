import { describe, expect, it } from 'vitest';
import { createItemId } from './feedService';

describe('createItemId', () => {
  it('同一ドメインの別記事では ID が異なる', () => {
    const a = createItemId('kw-1', 'https://www.google.com/url?rct=j&sa=t&url=https://example.com/articles/1');
    const b = createItemId('kw-1', 'https://www.google.com/url?rct=j&sa=t&url=https://example.com/articles/2');
    expect(a).not.toBe(b);
  });

  it('トラッキングパラメータだけが違う同一記事では ID が一致する', () => {
    const a = createItemId('kw-1', 'HTTPS://WWW.Example.com/articles/1/?utm_source=google&utm_medium=email#top');
    const b = createItemId('kw-1', 'https://www.example.com/articles/1?fbclid=abc123');
    expect(a).toBe(b);
  });
});
