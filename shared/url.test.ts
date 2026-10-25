import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('スキームとホストを小文字化する', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });

  it('トラッキングパラメータを除去し、他のパラメータは残す', () => {
    expect(
      normalizeUrl('https://example.com/a?id=1&utm_source=x&UTM_Medium=y&fbclid=f&gclid=g&page=2')
    ).toBe('https://example.com/a?id=1&page=2');
  });

  it('残ったパラメータはキー順に並べる', () => {
    expect(normalizeUrl('https://example.com/a?b=2&a=1')).toBe('https://example.com/a?a=1&b=2');
  });

  it('フラグメントと末尾スラッシュを除去する', () => {
    expect(normalizeUrl('https://example.com/a/b/#section')).toBe('https://example.com/a/b');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
  });

  it('URL でない値は前後の空白だけ除いて返す', () => {
    expect(normalizeUrl('  タイトル-1 ')).toBe('タイトル-1');
  });
});
