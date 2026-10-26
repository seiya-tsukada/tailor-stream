import { FAVICON_CONFIG } from '../config/constants';
import { MESSAGES } from '../config/messages';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_DAYS_LIMIT = 7;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 相対日時（例: "3分前", "2時間前", "3日前", "10/01", "2025/10/01"） */
export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  const diff = now.getTime() - date.getTime();
  const { RELATIVE_TIME } = MESSAGES;
  if (diff < MINUTE_MS) return RELATIVE_TIME.JUST_NOW;
  if (diff < HOUR_MS) return RELATIVE_TIME.MINUTES_AGO(Math.floor(diff / MINUTE_MS));
  if (diff < DAY_MS) return RELATIVE_TIME.HOURS_AGO(Math.floor(diff / HOUR_MS));
  if (diff < RELATIVE_DAYS_LIMIT * DAY_MS) return RELATIVE_TIME.DAYS_AGO(Math.floor(diff / DAY_MS));

  const monthDay = `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
  return date.getFullYear() === now.getFullYear() ? monthDay : `${date.getFullYear()}/${monthDay}`;
}

/** Google Favicon API の URL */
export function getFaviconUrl(domain: string): string {
  return `${FAVICON_CONFIG.ENDPOINT}?domain=${encodeURIComponent(domain)}&sz=${FAVICON_CONFIG.SIZE}`;
}
