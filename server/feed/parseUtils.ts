/**
 * Google Alert 向けパーサー＆サニタイズユーティリティ
 */

const FALLBACK_DOMAIN = 'Web';
const FAVICON_ENDPOINT = 'https://www.google.com/s2/favicons';
const FAVICON_SIZE = 64;
const FALLBACK_FAVICON_DOMAIN = 'google.com';

const HTML_ENTITIES: Record<string, string> = {
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

function decodeNumericEntity(entity: string, prefixLength: number, radix: number): string {
  const code = parseInt(entity.substring(prefixLength, entity.length - 1), radix);
  return !isNaN(code) ? String.fromCharCode(code) : entity;
}

// HTML タグ除去＆エンティティデコード
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  const withoutTags = rawHtml
    .replace(/<(br|p|div)\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '');

  const decoded = withoutTags.replace(/&[a-zA-Z0-9#x]+;/g, (entity) => {
    if (HTML_ENTITIES[entity]) return HTML_ENTITIES[entity];
    if (entity.startsWith('&#x') || entity.startsWith('&#X')) {
      return decodeNumericEntity(entity, 3, 16);
    }
    if (entity.startsWith('&#')) {
      return decodeNumericEntity(entity, 2, 10);
    }
    return entity;
  });

  return decoded.replace(/\s+/g, ' ').trim();
}

// Google 転送URL (https://www.google.com/url?rct=j&sa=t&url=...) からオリジナルURLを抽出
export function extractOriginalUrl(googleUrl: string): string {
  if (!googleUrl) return '';
  try {
    if (!googleUrl.includes('google.') || !googleUrl.includes('/url?')) {
      return googleUrl;
    }
    const parsed = new URL(googleUrl);
    const targetUrl = parsed.searchParams.get('url') || parsed.searchParams.get('q');
    if (!targetUrl) return googleUrl;

    // 2重エンコードにも対応
    let decoded = decodeURIComponent(targetUrl);
    if (decoded.includes('%3A') || decoded.includes('%2F')) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // ignore
      }
    }
    return decoded;
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
  if (!url) return FALLBACK_DOMAIN;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname || FALLBACK_DOMAIN;
  } catch {
    return FALLBACK_DOMAIN;
  }
}

// Google Favicon API を利用したファビコン取得URL
export function getFaviconUrl(domain: string): string {
  const target = !domain || domain === FALLBACK_DOMAIN ? FALLBACK_FAVICON_DOMAIN : encodeURIComponent(domain);
  return `${FAVICON_ENDPOINT}?domain=${target}&sz=${FAVICON_SIZE}`;
}
