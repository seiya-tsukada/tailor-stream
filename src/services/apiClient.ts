import type { Category, ErrorCode, FeedResponse } from '../api/types';
import { API_PATHS, URL_QUERY_KEYS } from '../config/constants';
import { MESSAGES } from '../config/messages';

/** API がエラーを返したときの例外（message はサーバーの固定メッセージ、無ければクライアント側の文言） */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode | null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** {"error": {"code", "message"}} 形式のエラー本文を取り出す */
export function parseErrorBody(body: unknown): { code: ErrorCode; message: string } | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const { code, message } = body.error;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return { code: code as ErrorCode, message };
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(MESSAGES.NETWORK_ERROR, 0, null);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = parseErrorBody(body);
    throw new ApiError(error?.message ?? MESSAGES.SERVER_ERROR(response.status), response.status, error?.code ?? null);
  }
  return body as T;
}

export function fetchCategories(): Promise<Category[]> {
  return getJson<Category[]>(API_PATHS.CATEGORIES);
}

export function fetchFeed(categoryIds: readonly string[]): Promise<FeedResponse> {
  const params = new URLSearchParams({ [URL_QUERY_KEYS.CATEGORIES]: categoryIds.join(',') });
  return getJson<FeedResponse>(`${API_PATHS.FEED}?${params.toString()}`);
}
