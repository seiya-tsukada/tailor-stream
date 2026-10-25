import { describe, expect, it } from 'vitest';
import { type ArticleRow, type IngestionRun, fromRow, isPlan, toRow } from './domain';

const articleRow: ArticleRow = {
  id: 'abc',
  provider: 'mock',
  provider_article_id: null,
  canonical_url: 'https://example.com/a',
  title: 'title',
  snippet: null,
  source_name: 'Example',
  source_domain: 'example.com',
  language: 'en',
  region: 'global',
  image_url: null,
  published_at: '2026-10-25T00:00:00.000Z',
  share_count: null,
  popularity_score: 1.5,
  cluster_id: 'c1',
  fetched_at: '2026-10-25T00:00:00.000Z',
  expires_at: '2026-10-27T00:00:00.000Z',
};

describe('fromRow / toRow', () => {
  it('スネークケースのキーをキャメルケースに変換し、値は変えない', () => {
    const article = fromRow(articleRow);
    expect(article.canonicalUrl).toBe('https://example.com/a');
    expect(article.providerArticleId).toBeNull();
    expect(article.popularityScore).toBe(1.5);
    expect(Object.keys(article)).not.toContain('canonical_url');
  });

  it('往復変換で元の行に戻る', () => {
    expect(toRow(fromRow(articleRow))).toEqual(articleRow);
  });

  it('キャメルケースのエンティティを DB の行に変換する', () => {
    const run: IngestionRun = {
      id: 1,
      provider: 'mock',
      categoryId: 'ai',
      startedAt: '2026-10-25T00:00:00.000Z',
      finishedAt: null,
      status: 'running',
      fetchedCount: null,
      requestUnits: 3,
      error: null,
    };
    expect(toRow(run)).toEqual({
      id: 1,
      provider: 'mock',
      category_id: 'ai',
      started_at: '2026-10-25T00:00:00.000Z',
      finished_at: null,
      status: 'running',
      fetched_count: null,
      request_units: 3,
      error: null,
    });
  });
});

describe('isPlan', () => {
  it('free / pro のみ受け付ける', () => {
    expect(isPlan('free')).toBe(true);
    expect(isPlan('pro')).toBe(true);
    expect(isPlan('enterprise')).toBe(false);
    expect(isPlan(null)).toBe(false);
  });
});
