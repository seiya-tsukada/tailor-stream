import { createHash } from 'node:crypto';
import { normalizeUrl } from '../../shared/url';
import { FEED_DEFAULTS } from '../config';

/** 正規化した URL の SHA-256 から記事 ID を作る（同じ記事なら同じ ID になる） */
export function createArticleId(url: string): string {
  return createHash('sha256').update(normalizeUrl(url)).digest('hex').substring(0, FEED_DEFAULTS.ARTICLE_ID_LENGTH);
}
