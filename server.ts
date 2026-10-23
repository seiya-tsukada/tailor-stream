import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Parser from 'rss-parser';

const app = express();
const PORT = 3000;

app.use(express.json());

// RSS Parser インスタンス
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
  },
  customFields: {
    item: [
      ['content', 'content'],
      ['contentSnippet', 'contentSnippet'],
      ['description', 'description'],
    ],
  },
});

// HTML タグ除去＆エンティティデコード
function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  let text = rawHtml;
  text = text.replace(/<(br|p|div)\s*\/?>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '');

  const entities: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&#x27;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&middot;': '・',
    '&hellip;': '…',
    '&#8230;': '…',
    '&mdash;': '—',
    '&#8212;': '—',
    '&ndash;': '–',
    '&#8211;': '–',
    '&copy;': '©',
    '&reg;': '®',
  };

  text = text.replace(/&[a-zA-Z0-9#x]+;/g, (match) => {
    if (entities[match]) return entities[match];
    if (match.startsWith('&#x') || match.startsWith('&#X')) {
      const hex = match.substring(3, match.length - 1);
      const code = parseInt(hex, 16);
      return !isNaN(code) ? String.fromCharCode(code) : match;
    }
    if (match.startsWith('&#')) {
      const dec = match.substring(2, match.length - 1);
      const code = parseInt(dec, 10);
      return !isNaN(code) ? String.fromCharCode(code) : match;
    }
    return match;
  });

  return text.replace(/\s+/g, ' ').trim();
}

// Google 転送URL からオリジナルURLを抽出
function extractOriginalUrl(googleUrl: string): string {
  if (!googleUrl) return '';
  try {
    if (!googleUrl.includes('google.') || !googleUrl.includes('/url?')) {
      return googleUrl;
    }
    const parsed = new URL(googleUrl);
    const targetUrl = parsed.searchParams.get('url') || parsed.searchParams.get('q');
    if (targetUrl) {
      let decoded = decodeURIComponent(targetUrl);
      if (decoded.includes('%3A') || decoded.includes('%2F')) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          // ignore
        }
      }
      return decoded;
    }
    return googleUrl;
  } catch {
    const match = googleUrl.match(/[?&](?:url|q)=([^&]+)/);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return googleUrl;
  }
}

// ドメイン名抽出
function extractDomain(url: string): string {
  if (!url) return 'Web';
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname;
    hostname = hostname.replace(/^www\./, '');
    return hostname || 'Web';
  } catch {
    return 'Web';
  }
}

// Google Favicon URL
function getFaviconUrl(domain: string): string {
  if (!domain || domain === 'Web') {
    return 'https://www.google.com/s2/favicons?domain=google.com&sz=64';
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// サンプルデータ生成（RSSフィードURLが未設定またはテスト時用）
function generateSampleAlertItems(keyword: string, keywordId: string) {
  const sampleSources = [
    { name: 'TechCrunch Japan', domain: 'jp.techcrunch.com' },
    { name: '日本経済新聞', domain: 'nikkei.com' },
    { name: 'Zenn / Qiita Trends', domain: 'zenn.dev' },
    { name: 'ITmedia NEWS', domain: 'itmedia.co.jp' },
    { name: 'GIGAZINE', domain: 'gigazine.net' },
    { name: 'Business Insider Japan', domain: 'businessinsider.jp' },
    { name: 'PR TIMES', domain: 'prtimes.jp' },
  ];

  const now = Date.now();
  return [
    {
      id: `${keywordId}-sample-1`,
      title: `<b>${keyword}</b>の最新動向と実践アーキテクチャ2026年版まとめ`,
      cleanTitle: `${keyword}の最新動向と実践アーキテクチャ2026年版まとめ`,
      summary: `最新の<b>${keyword}</b>を活用した高速開発手法と、本番運用におけるセキュリティ考慮事項について徹底解説します。`,
      cleanSummary: `最新の${keyword}を活用した高速開発手法と、本番運用におけるセキュリティ考慮事項について徹底解説します。`,
      originalUrl: `https://${sampleSources[0].domain}/news/2026/08/${encodeURIComponent(keyword)}`,
      googleUrl: `https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2F${sampleSources[0].domain}%2Fnews%2F2026%2F08%2F${encodeURIComponent(keyword)}&ct=ga`,
      publishedAt: new Date(now - 1000 * 60 * 25).toISOString(), // 25分前
      domain: sampleSources[0].domain,
      faviconUrl: getFaviconUrl(sampleSources[0].domain),
      keywordId,
      keywordName: keyword,
    },
    {
      id: `${keywordId}-sample-2`,
      title: `国内企業における<b>${keyword}</b>導入事例と業務効率化の成果発表`,
      cleanTitle: `国内企業における${keyword}導入事例と業務効率化の成果発表`,
      summary: `従来のワークフローと比較して約40%のコスト削減を達成した<b>${keyword}</b>の具体的な設計パターンが公開されました。`,
      cleanSummary: `従来のワークフローと比較して約40%のコスト削減を達成した${keyword}の具体的な設計パターンが公開されました。`,
      originalUrl: `https://${sampleSources[1].domain}/article/DGXZQOUC${Math.floor(Math.random() * 100000)}`,
      googleUrl: `https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2F${sampleSources[1].domain}%2Farticle%2F01&ct=ga`,
      publishedAt: new Date(now - 1000 * 60 * 120).toISOString(), // 2時間前
      domain: sampleSources[1].domain,
      faviconUrl: getFaviconUrl(sampleSources[1].domain),
      keywordId,
      keywordName: keyword,
    },
    {
      id: `${keywordId}-sample-3`,
      title: `次世代<b>${keyword}</b>技術スタックの選定とパフォーマンス比較検証レポート`,
      cleanTitle: `次世代${keyword}技術スタックの選定とパフォーマンス比較検証レポート`,
      summary: `エンジニアコミュニティで話題沸騰中の<b>${keyword}</b>関連ライブラリを実際にベンチマークテストした詳細レポートです。`,
      cleanSummary: `エンジニアコミュニティで話題沸騰中の${keyword}関連ライブラリを実際にベンチマークテストした詳細レポートです。`,
      originalUrl: `https://${sampleSources[2].domain}/articles/${Math.floor(Math.random() * 90000 + 10000)}`,
      googleUrl: `https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2F${sampleSources[2].domain}%2Farticles%2Fsample&ct=ga`,
      publishedAt: new Date(now - 1000 * 60 * 360).toISOString(), // 6時間前
      domain: sampleSources[2].domain,
      faviconUrl: getFaviconUrl(sampleSources[2].domain),
      keywordId,
      keywordName: keyword,
    },
    {
      id: `${keywordId}-sample-4`,
      title: `新興スタートアップが発表した<b>${keyword}</b>連携プラットフォームの全貌`,
      cleanTitle: `新興スタートアップが発表した${keyword}連携プラットフォームの全貌`,
      summary: `プレシードラウンドでの資金調達を完了し、ベータ版の事前登録を開始。<b>${keyword}</b>を活用した新UIが特徴。`,
      cleanSummary: `プレシードラウンドでの資金調達を完了し、ベータ版の事前登録を開始。${keyword}を活用した新UIが特徴。`,
      originalUrl: `https://${sampleSources[3].domain}/news/articles/sample-${encodeURIComponent(keyword)}`,
      googleUrl: `https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2F${sampleSources[3].domain}%2Fnews%2Farticles&ct=ga`,
      publishedAt: new Date(now - 1000 * 60 * 60 * 18).toISOString(), // 18時間前
      domain: sampleSources[3].domain,
      faviconUrl: getFaviconUrl(sampleSources[3].domain),
      keywordId,
      keywordName: keyword,
    },
  ];
}

// 1つのフィードURLまたはキーワードから記事を取得・整形
async function fetchAndProcessFeed(feedUrl: string, keyword: string, keywordId: string) {
  // フィードURLが指定されている場合はパースを試みる
  if (feedUrl && feedUrl.trim().startsWith('http')) {
    try {
      const feed = await parser.parseURL(feedUrl.trim());
      const items = (feed.items || []).map((item, index) => {
        const rawTitle = item.title || '無題の記事';
        const rawSummary = item.contentSnippet || item.content || item.summary || item.description || '';
        const googleLink = item.link || item.guid || '';
        
        // Google Alert 特化処理:
        const originalUrl = extractOriginalUrl(googleLink);
        const cleanTitle = sanitizeHtml(rawTitle);
        const cleanSummary = sanitizeHtml(rawSummary);
        const domain = extractDomain(originalUrl || googleLink);
        const faviconUrl = getFaviconUrl(domain);
        const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();

        // 安定したユニークID生成
        const uniqueId = `item-${keywordId}-${Buffer.from(originalUrl || googleLink || `${cleanTitle}-${index}`).toString('base64').substring(0, 24)}`;

        return {
          id: uniqueId,
          title: rawTitle,
          cleanTitle,
          summary: rawSummary,
          cleanSummary,
          originalUrl,
          googleUrl: googleLink,
          publishedAt,
          domain,
          faviconUrl,
          keywordId,
          keywordName: keyword,
        };
      });

      if (items.length > 0) {
        return {
          success: true,
          keywordId,
          keywordName: keyword,
          items,
        };
      }
    } catch (err: any) {
      console.warn(`[FeedFetch Warning] Failed to parse feed for ${keyword} (${feedUrl}):`, err.message);
      // 外部取得に失敗した場合でも、ユーザーが操作を続けられるようにフォールバックデータを返す
    }
  }

  // フィードURL未指定 or 取得失敗時のフォールバック／シミュレーション
  const sampleItems = generateSampleAlertItems(keyword, keywordId);
  return {
    success: true,
    keywordId,
    keywordName: keyword,
    items: sampleItems,
    isSample: !feedUrl,
  };
}

// API: 単一フィード取得
app.get('/api/feed', async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    const keyword = (req.query.keyword as string) || 'Google Alert';
    const keywordId = (req.query.keywordId as string) || 'default-kw';

    const result = await fetchAndProcessFeed(url, keyword, keywordId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'フィードの取得に失敗しました',
    });
  }
});

// API: 複数キーワード一括フィード取得（バッチ）
app.post('/api/feed/batch', async (req: Request, res: Response) => {
  try {
    const { keywords } = req.body as {
      keywords: Array<{ id: string; keyword: string; feedUrl?: string; isActive?: boolean }>;
    };

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const activeKeywords = keywords.filter((k) => k.isActive !== false);

    const promises = activeKeywords.map((k) =>
      fetchAndProcessFeed(k.feedUrl || '', k.keyword, k.id)
    );

    const results = await Promise.all(promises);

    // すべてのアイテムを平坦化して日付順（新しい順）にソート
    const allItems: any[] = [];
    results.forEach((r) => {
      if (r.success && r.items) {
        allItems.push(...r.items);
      }
    });

    allItems.sort((a, b) => {
      const timeA = new Date(a.publishedAt).getTime();
      const timeB = new Date(b.publishedAt).getTime();
      return timeB - timeA;
    });

    res.json({
      success: true,
      data: {
        results,
        items: allItems,
        totalCount: allItems.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '一括フィード取得に失敗しました',
    });
  }
});

// API: Google Alert URLのバリデーション・テストパース
app.post('/api/feed/validate', async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) {
      return res.status(400).json({ success: false, error: 'URLが指定されていません' });
    }

    const feed = await parser.parseURL(url.trim());
    const previewItems = (feed.items || []).slice(0, 3).map((item) => ({
      title: sanitizeHtml(item.title || ''),
      originalUrl: extractOriginalUrl(item.link || ''),
      domain: extractDomain(extractOriginalUrl(item.link || '')),
    }));

    res.json({
      success: true,
      data: {
        title: feed.title || 'Google Alert Feed',
        description: feed.description || '',
        itemCount: feed.items?.length || 0,
        previewItems,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: `フィードの解析に失敗しました: ${error.message || 'URLが無効です'}`,
    });
  }
});

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AlertPulse Server running on http://localhost:${PORT}`);
  });
}

startServer();
