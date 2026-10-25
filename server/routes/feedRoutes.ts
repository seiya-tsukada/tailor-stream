import { Request, Response, Router } from 'express';
import { API_ROUTES, FeedItemPayload, FeedKeywordPayload } from '../../shared/api';
import { getErrorMessage } from '../../shared/errors';
import { FEED_DEFAULTS, SERVER_MESSAGES } from '../config';
import { fetchAndProcessFeed, validateFeed } from '../feed/feedService';

export const feedRouter = Router();

const byPublishedAtDesc = (a: FeedItemPayload, b: FeedItemPayload) =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

// 単一フィード取得
feedRouter.get(API_ROUTES.FEED, async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    const keyword = (req.query.keyword as string) || FEED_DEFAULTS.KEYWORD;
    const keywordId = (req.query.keywordId as string) || FEED_DEFAULTS.KEYWORD_ID;

    const result = await fetchAndProcessFeed(url, keyword, keywordId);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, SERVER_MESSAGES.FEED_FETCH_FAILED),
    });
  }
});

// 複数キーワード一括フィード取得（バッチ）
feedRouter.post(API_ROUTES.FEED_BATCH, async (req: Request, res: Response) => {
  try {
    const { keywords } = req.body as { keywords: FeedKeywordPayload[] };

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const activeKeywords = keywords.filter((k) => k.isActive !== false);
    const results = await Promise.all(
      activeKeywords.map((k) => fetchAndProcessFeed(k.feedUrl || '', k.keyword, k.id))
    );

    // すべてのアイテムを平坦化して日付順（新しい順）にソート
    const allItems = results
      .filter((r) => r.success && r.items)
      .flatMap((r) => r.items)
      .sort(byPublishedAtDesc);

    res.json({
      success: true,
      data: { results, items: allItems, totalCount: allItems.length },
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, SERVER_MESSAGES.BATCH_FETCH_FAILED),
    });
  }
});

// Google Alert URLのバリデーション・テストパース
feedRouter.post(API_ROUTES.FEED_VALIDATE, async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) {
      return res.status(400).json({ success: false, error: SERVER_MESSAGES.URL_REQUIRED });
    }

    const data = await validateFeed(url);
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(400).json({
      success: false,
      error: `${SERVER_MESSAGES.FEED_PARSE_FAILED}: ${getErrorMessage(error, SERVER_MESSAGES.INVALID_URL)}`,
    });
  }
});

// ヘルスチェック
feedRouter.get(API_ROUTES.HEALTH, (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
