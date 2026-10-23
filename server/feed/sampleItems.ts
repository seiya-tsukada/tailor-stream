import type { FeedItemPayload } from '../../shared/api';
import { getFaviconUrl } from './parseUtils';

/**
 * RSS フィード URL が未設定、または取得に失敗したときに返すサンプル記事
 */

const MINUTE_MS = 1000 * 60;
const GOOGLE_REDIRECT_BASE = 'https://www.google.com/url?rct=j&sa=t&url=';

interface SampleTemplate {
  domain: string;
  /** `{kw}` がキーワードに置き換わる。`<b>` で囲まれた部分は cleanTitle では除去される */
  title: string;
  summary: string;
  originalPath: (encodedKeyword: string) => string;
  /** Google 転送 URL の url パラメータ（エンコード済みのパス） */
  googlePath: (encodedKeyword: string) => string;
  minutesAgo: number;
}

const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    domain: 'jp.techcrunch.com',
    title: '<b>{kw}</b>の最新動向と実践アーキテクチャ2026年版まとめ',
    summary: '最新の<b>{kw}</b>を活用した高速開発手法と、本番運用におけるセキュリティ考慮事項について徹底解説します。',
    originalPath: (kw) => `/news/2026/08/${kw}`,
    googlePath: (kw) => `%2Fnews%2F2026%2F08%2F${kw}`,
    minutesAgo: 25,
  },
  {
    domain: 'nikkei.com',
    title: '国内企業における<b>{kw}</b>導入事例と業務効率化の成果発表',
    summary: '従来のワークフローと比較して約40%のコスト削減を達成した<b>{kw}</b>の具体的な設計パターンが公開されました。',
    originalPath: () => `/article/DGXZQOUC${Math.floor(Math.random() * 100000)}`,
    googlePath: () => '%2Farticle%2F01',
    minutesAgo: 120,
  },
  {
    domain: 'zenn.dev',
    title: '次世代<b>{kw}</b>技術スタックの選定とパフォーマンス比較検証レポート',
    summary: 'エンジニアコミュニティで話題沸騰中の<b>{kw}</b>関連ライブラリを実際にベンチマークテストした詳細レポートです。',
    originalPath: () => `/articles/${Math.floor(Math.random() * 90000 + 10000)}`,
    googlePath: () => '%2Farticles%2Fsample',
    minutesAgo: 360,
  },
  {
    domain: 'itmedia.co.jp',
    title: '新興スタートアップが発表した<b>{kw}</b>連携プラットフォームの全貌',
    summary: 'プレシードラウンドでの資金調達を完了し、ベータ版の事前登録を開始。<b>{kw}</b>を活用した新UIが特徴。',
    originalPath: (kw) => `/news/articles/sample-${kw}`,
    googlePath: () => '%2Fnews%2Farticles',
    minutesAgo: 60 * 18,
  },
];

const fillKeyword = (template: string, keyword: string) => template.split('{kw}').join(keyword);
const stripBold = (text: string) => text.replace(/<\/?b>/g, '');

export function generateSampleAlertItems(keyword: string, keywordId: string): FeedItemPayload[] {
  const now = Date.now();
  const encodedKeyword = encodeURIComponent(keyword);

  return SAMPLE_TEMPLATES.map((template, index) => {
    const title = fillKeyword(template.title, keyword);
    const summary = fillKeyword(template.summary, keyword);

    return {
      id: `${keywordId}-sample-${index + 1}`,
      title,
      cleanTitle: fillKeyword(stripBold(template.title), keyword),
      summary,
      cleanSummary: fillKeyword(stripBold(template.summary), keyword),
      originalUrl: `https://${template.domain}${template.originalPath(encodedKeyword)}`,
      googleUrl: `${GOOGLE_REDIRECT_BASE}https%3A%2F%2F${template.domain}${template.googlePath(encodedKeyword)}&ct=ga`,
      publishedAt: new Date(now - MINUTE_MS * template.minutesAgo).toISOString(),
      domain: template.domain,
      faviconUrl: getFaviconUrl(template.domain),
      keywordId,
      keywordName: keyword,
    };
  });
}
