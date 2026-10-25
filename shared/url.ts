/**
 * URL 正規化ユーティリティ（クライアント・サーバー共通）
 */

/** 正規化時に除去するトラッキング用クエリパラメータ（utm_* は前方一致で別途除去） */
export const TRACKING_PARAMS: readonly string[] = [
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'yclid',
  'msclkid',
  'twclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
];

const TRACKING_PARAM_PREFIX = 'utm_';

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith(TRACKING_PARAM_PREFIX) || TRACKING_PARAMS.includes(lower);
}

/**
 * 同じ記事を指す URL が同じ文字列になるように正規化する
 * - スキーム・ホストを小文字化（URL パーサーが行う）
 * - トラッキングパラメータ・フラグメント・末尾スラッシュを除去
 * - 残ったクエリパラメータはキー順に並べ替える
 * URL として解釈できない値は前後の空白だけ除いてそのまま返す。
 */
export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const params = [...parsed.searchParams.entries()]
    .filter(([name]) => !isTrackingParam(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const search = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
  const pathname = parsed.pathname.replace(/\/+$/, '');

  return `${parsed.protocol}//${parsed.host}${pathname}${search}`;
}
