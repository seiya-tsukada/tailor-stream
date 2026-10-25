import Parser from 'rss-parser';
import type { FeedFetchResult, FeedItemPayload, FeedValidateResponseData } from '../../shared/api';
import { FEED_DEFAULTS, RSS_CONFIG } from '../config';
import { getErrorMessage } from '../../shared/errors';
import { createArticleId } from './articleId';
import { extractDomain, extractOriginalUrl, getFaviconUrl, sanitizeHtml } from './parseUtils';
import { generateSampleAlertItems } from './sampleItems';

const parser = new Parser({
  timeout: RSS_CONFIG.TIMEOUT_MS,
  headers: {
    'User-Agent': RSS_CONFIG.USER_AGENT,
    Accept: RSS_CONFIG.ACCEPT,
  },
  customFields: {
    item: [
      ['content', 'content'],
      ['contentSnippet', 'contentSnippet'],
      ['description', 'description'],
    ],
  },
});

type RssItem = Parser.Item & { description?: string };

// 安定したユニークID生成（同じ記事が複数キーワードに出ても重複しないようキーワードIDを前置する）
export function createItemId(keywordId: string, seed: string): string {
  return `item-${keywordId}-${createArticleId(seed)}`;
}

function toFeedItem(item: RssItem, index: number, keyword: string, keywordId: string): FeedItemPayload {
  const rawTitle = item.title || FEED_DEFAULTS.UNTITLED_ARTICLE;
  const rawSummary = item.contentSnippet || item.content || item.summary || item.description || '';
  const googleLink = item.link || item.guid || '';

  const originalUrl = extractOriginalUrl(googleLink);
  const cleanTitle = sanitizeHtml(rawTitle);
  const domain = extractDomain(originalUrl || googleLink);

  return {
    id: createItemId(keywordId, originalUrl || googleLink || `${cleanTitle}-${index}`),
    title: rawTitle,
    cleanTitle,
    summary: rawSummary,
    cleanSummary: sanitizeHtml(rawSummary),
    originalUrl,
    googleUrl: googleLink,
    publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    domain,
    faviconUrl: getFaviconUrl(domain),
    keywordId,
    keywordName: keyword,
  };
}

// 1つのフィードURLまたはキーワードから記事を取得・整形
export async function fetchAndProcessFeed(
  feedUrl: string,
  keyword: string,
  keywordId: string
): Promise<FeedFetchResult> {
  if (feedUrl && feedUrl.trim().startsWith('http')) {
    try {
      const feed = await parser.parseURL(feedUrl.trim());
      const items = (feed.items || []).map((item, index) => toFeedItem(item, index, keyword, keywordId));

      if (items.length > 0) {
        return { success: true, keywordId, keywordName: keyword, items };
      }
    } catch (err: unknown) {
      console.warn(`[FeedFetch Warning] Failed to parse feed for ${keyword} (${feedUrl}):`, getErrorMessage(err, ''));
      // 外部取得に失敗した場合でも、ユーザーが操作を続けられるようにフォールバックデータを返す
    }
  }

  // フィードURL未指定 or 取得失敗時のフォールバック
  return {
    success: true,
    keywordId,
    keywordName: keyword,
    items: generateSampleAlertItems(keyword, keywordId),
    isSample: !feedUrl,
  };
}

// Google Alert URL のバリデーション・テストパース
export async function validateFeed(url: string): Promise<FeedValidateResponseData> {
  const feed = await parser.parseURL(url.trim());
  const previewItems = (feed.items || []).slice(0, FEED_DEFAULTS.VALIDATE_PREVIEW_COUNT).map((item) => {
    const originalUrl = extractOriginalUrl(item.link || '');
    return {
      title: sanitizeHtml(item.title || ''),
      originalUrl,
      domain: extractDomain(originalUrl),
    };
  });

  return {
    title: feed.title || FEED_DEFAULTS.FEED_TITLE,
    description: feed.description || '',
    itemCount: feed.items?.length || 0,
    previewItems,
  };
}
