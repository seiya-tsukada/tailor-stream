/**
 * Google Alert 向けパーサー＆サニタイズユーティリティ
 */

// HTMLタグの除去とHTMLエンティティのデコード
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let text = rawHtml;

  // 1. 改行タグや段落タグをスペース/改行に変換
  text = text.replace(/<(br|p|div)\s*\/?>/gi, ' ');

  // 2. すべてのHTMLタグを除去
  text = text.replace(/<[^>]+>/g, '');

  // 3. HTMLエンティティのデコード
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
    '&trade;': '™',
  };

  text = text.replace(/&[a-zA-Z0-9#x]+;/g, (match) => {
    if (entities[match]) return entities[match];
    // 数値文字参照 &#1234; または &#x12a;
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

  // 余分な空白の正規化
  return text.replace(/\s+/g, ' ').trim();
}

// Google 転送URL (https://www.google.com/url?rct=j&sa=t&url=...) からオリジナルURLを抽出
export function extractOriginalUrl(googleUrl: string): string {
  if (!googleUrl) return '';

  try {
    // 既に直接URLの場合はそのまま返す
    if (!googleUrl.includes('google.') || !googleUrl.includes('/url?')) {
      return googleUrl;
    }

    const parsed = new URL(googleUrl);
    const targetUrl = parsed.searchParams.get('url') || parsed.searchParams.get('q');

    if (targetUrl) {
      // 念のため2重エンコードにも対応
      let decoded = decodeURIComponent(targetUrl);
      if (decoded.includes('%3A') || decoded.includes('%2F')) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          // fallback
        }
      }
      return decoded;
    }

    return googleUrl;
  } catch {
    // URL パースに失敗した場合は正規表現でフォールバック
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

// ドメイン名（情報ソース）の抽出
export function extractDomain(url: string): string {
  if (!url) return 'Web';

  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname;
    // www. を除去
    hostname = hostname.replace(/^www\./, '');
    return hostname || 'Web';
  } catch {
    return 'Web';
  }
}

// Google Favicon API を利用したファビコン取得URL
export function getFaviconUrl(domain: string): string {
  if (!domain || domain === 'Web') {
    return 'https://www.google.com/s2/favicons?domain=google.com&sz=64';
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// 相対日時のフォーマット（例: "3分前", "2時間前", "昨日", "2026/08/25"）
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'たった今';
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}分前`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}時間前`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}日前`;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (year === now.getFullYear()) {
      return `${month}/${day}`;
    }
    return `${year}/${month}/${day}`;
  } catch {
    return dateString;
  }
}

// キーワードから Google Alert の作成ページURL・RSS形式の説明を生成
export function createGoogleAlertsWebUrl(keyword: string): string {
  return `https://www.google.co.jp/alerts#create:q=${encodeURIComponent(keyword)}`;
}

// プリセットサンプルキーワード（初回起動時やデモ用）
export const INITIAL_PRESET_KEYWORDS = [
  {
    id: 'kw-ai-agents',
    keyword: 'AI エージェント',
    feedUrl: '', // デモやカスタム登録用
    isActive: true,
    color: '#3B82F6', // Blue
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kw-nextjs',
    keyword: 'Next.js React',
    feedUrl: '',
    isActive: true,
    color: '#10B981', // Emerald
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kw-tech-trends',
    keyword: '生成AI スタートアップ',
    feedUrl: '',
    isActive: true,
    color: '#8B5CF6', // Purple
    createdAt: new Date().toISOString(),
  },
];
