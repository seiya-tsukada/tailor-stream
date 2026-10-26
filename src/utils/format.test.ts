import { describe, expect, it } from 'vitest';
import { formatRelativeTime, getFaviconUrl } from './format';

const NOW = new Date(2026, 9, 26, 12, 0, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('formatRelativeTime', () => {
  it('経過時間に応じて表示を変える', () => {
    expect(formatRelativeTime(ago(30 * 1000), NOW)).toBe('たった今');
    expect(formatRelativeTime(ago(5 * 60 * 1000), NOW)).toBe('5分前');
    expect(formatRelativeTime(ago(3 * 60 * 60 * 1000), NOW)).toBe('3時間前');
    expect(formatRelativeTime(ago(2 * 24 * 60 * 60 * 1000), NOW)).toBe('2日前');
  });

  it('7日以上前は日付を出し、年が違えば年も出す', () => {
    expect(formatRelativeTime(new Date(2026, 9, 1).toISOString(), NOW)).toBe('10/01');
    expect(formatRelativeTime(new Date(2025, 0, 2).toISOString(), NOW)).toBe('2025/01/02');
  });

  it('日付として解釈できない値はそのまま返す', () => {
    expect(formatRelativeTime('not a date', NOW)).toBe('not a date');
  });
});

describe('getFaviconUrl', () => {
  it('ドメインをエンコードして埋め込む', () => {
    expect(getFaviconUrl('example.com')).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=64');
  });
});
