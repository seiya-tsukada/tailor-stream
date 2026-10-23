import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

// RSS Parser 初期化
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*',
  },
});

// 1. タイトルや概要に含まれるHTMLタグのサニタイズ（プレーンテキスト化）
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
    '&ndash;': '–',
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

// 2. 元記事URLの自動抽出（Googleの転送クエリから本来のWebサイトURLを復元）
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

// 3. ドメイン名（情報ソース）の自動抽出
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

function getFaviconUrl(domain: string): string {
  if (!domain || domain === 'Web') {
    return 'https://www.google.com/s2/favicons?domain=google.com&sz=64';
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// サンプルデータ生成（RSS未設定時のプレビュー用）
function generateSampleAlertItems(keyword: string, keywordId: string) {
  const sampleSources = [
    { name: 'TechCrunch Japan', domain: 'jp.techcrunch.com' },
    { name: '日本経済新聞', domain: 'nikkei.com' },
    { name: 'Zenn / Qiita', domain: 'zenn.dev' },
    { name: 'ITmedia NEWS', domain: 'itmedia.co.jp' },
  ];
  const now = Date.now();

  return [
    {
      id: `${keywordId}-sample-1`,
      title: `<b>${keyword}</b>の最新動向と開発現場における実践まとめ`,
      cleanTitle: `${keyword}の最新動向と開発現場における実践まとめ`,
      summary: `最新の<b>${keyword}</b>の機能比較と、プロダクション導入におけるベストプラクティスを徹底解説。`,
      cleanSummary: `最新の${keyword}の機能比較と、プロダクション導入におけるベストプラクティスを徹底解説。`,
      originalUrl: `https://${sampleSources[0].domain}/news/${encodeURIComponent(keyword)}`,
      googleUrl: `https://www.google.com/url?url=https%3A%2F%2F${sampleSources[0].domain}`,
      publishedAt: new Date(now - 1000 * 60 * 30).toISOString(),
      domain: sampleSources[0].domain,
      faviconUrl: getFaviconUrl(sampleSources[0].domain),
      keywordId,
      keywordName: keyword,
    },
    {
      id: `${keywordId}-sample-2`,
      title: `国内企業が<b>${keyword}</b>の導入により大幅な業務効率化を達成`,
      cleanTitle: `国内企業が${keyword}の導入により大幅な業務効率化を達成`,
      summary: `従来の手動オペレーションを<b>${keyword}</b>で自動化し、工数を50%削減した事例が公開されました。`,
      cleanSummary: `従来の手動オペレーションを${keyword}で自動化し、工数を50%削減した事例が公開されました。`,
      originalUrl: `https://${sampleSources[1].domain}/article/sample`,
      googleUrl: `https://www.google.com/url?url=https%3A%2F%2F${sampleSources[1].domain}`,
      publishedAt: new Date(now - 1000 * 60 * 180).toISOString(),
      domain: sampleSources[1].domain,
      faviconUrl: getFaviconUrl(sampleSources[1].domain),
      keywordId,
      keywordName: keyword,
    },
  ];
}

async function fetchAndProcessFeed(feedUrl: string, keyword: string, keywordId: string) {
  if (feedUrl && feedUrl.trim().startsWith('http')) {
    try {
      const feed = await parser.parseURL(feedUrl.trim());
      const items = (feed.items || []).map((item, index) => {
        const rawTitle = item.title || '無題の記事';
        const rawSummary =
          item.contentSnippet || item.content || item.summary || item.description || '';
        const googleLink = item.link || item.guid || '';

        const originalUrl = extractOriginalUrl(googleLink);
        const cleanTitle = sanitizeHtml(rawTitle);
        const cleanSummary = sanitizeHtml(rawSummary);
        const domain = extractDomain(originalUrl || googleLink);
        const faviconUrl = getFaviconUrl(domain);
        const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();

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
        return { success: true, keywordId, keywordName: keyword, items };
      }
    } catch (err: any) {
      console.warn(`[Next.js API] Failed feed fetch for ${keyword}:`, err.message);
    }
  }

  return {
    success: true,
    keywordId,
    keywordName: keyword,
    items: generateSampleAlertItems(keyword, keywordId),
    isSample: !feedUrl,
  };
}

// GET: 単一フィード取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || '';
  const keyword = searchParams.get('keyword') || 'Google Alert';
  const keywordId = searchParams.get('keywordId') || 'default-kw';

  const result = await fetchAndProcessFeed(url, keyword, keywordId);
  return NextResponse.json({ success: true, data: result });
}

// POST: 複数キーワード一括フィード取得 (Batch)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keywords: Array<{ id: string; keyword: string; feedUrl?: string; isActive?: boolean }> =
      body.keywords || [];

    const activeKeywords = keywords.filter((k) => k.isActive !== false);
    const promises = activeKeywords.map((k) =>
      fetchAndProcessFeed(k.feedUrl || '', k.keyword, k.id)
    );

    const results = await Promise.all(promises);
    const allItems: any[] = [];
    results.forEach((r) => {
      if (r.success && r.items) {
        allItems.push(...r.items);
      }
    });

    allItems.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: { results, items: allItems, totalCount: allItems.length },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || '一括取得に失敗しました' },
      { status: 500 }
    );
  }
}
