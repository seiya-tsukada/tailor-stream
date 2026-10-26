import type { Category, ErrorCode, FeedResponse, Me, UserCategories } from '../api/types';
import { API_PATHS, URL_QUERY_KEYS } from '../config/constants';
import { MESSAGES } from '../config/messages';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NO_CONTENT = 204;

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

type Method = 'GET' | 'POST' | 'PUT';

/** セッション Cookie を送るため credentials: 'include' で呼ぶ */
async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(MESSAGES.NETWORK_ERROR, 0, null);
  }

  const json: unknown = response.status === HTTP_NO_CONTENT ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = parseErrorBody(json);
    throw new ApiError(error?.message ?? MESSAGES.SERVER_ERROR(response.status), response.status, error?.code ?? null);
  }
  return json as T;
}

export function fetchCategories(): Promise<Category[]> {
  return request<Category[]>('GET', API_PATHS.CATEGORIES);
}

/** ログイン中はサーバーがユーザー設定のカテゴリを使うので、categoryIds は未ログインのときだけ使われる */
export function fetchFeed(categoryIds: readonly string[]): Promise<FeedResponse> {
  const params = new URLSearchParams({ [URL_QUERY_KEYS.CATEGORIES]: categoryIds.join(',') });
  return request<FeedResponse>('GET', `${API_PATHS.FEED}?${params.toString()}`);
}

/** ログイン中のユーザー。未ログインなら null */
export async function fetchMe(): Promise<Me | null> {
  try {
    return await request<Me>('GET', API_PATHS.ME);
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === HTTP_UNAUTHORIZED) return null;
    throw err;
  }
}

export function requestLoginLink(email: string): Promise<void> {
  return request<void>('POST', API_PATHS.AUTH_LOGIN_LINK, { email });
}

export function verifyLoginToken(token: string): Promise<Me> {
  return request<Me>('POST', API_PATHS.AUTH_VERIFY, { token });
}

export function logout(): Promise<void> {
  return request<void>('POST', API_PATHS.AUTH_LOGOUT);
}

export async function fetchMyCategories(): Promise<string[]> {
  return (await request<UserCategories>('GET', API_PATHS.ME_CATEGORIES)).categoryIds;
}

export async function saveMyCategories(categoryIds: readonly string[]): Promise<string[]> {
  return (await request<UserCategories>('PUT', API_PATHS.ME_CATEGORIES, { categoryIds })).categoryIds;
}
