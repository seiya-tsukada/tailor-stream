import {
  API_ROUTES,
  ApiResponse,
  FeedBatchResponseData,
  FeedKeywordPayload,
  FeedValidateResponseData,
} from '../../shared/api';
import { MESSAGES } from '../config/messages';

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// 複数キーワードのフィードを一括取得
export async function fetchFeedBatch(keywords: FeedKeywordPayload[]): Promise<FeedBatchResponseData> {
  const response = await postJson(API_ROUTES.FEED_BATCH, { keywords });

  if (!response.ok) {
    throw new Error(MESSAGES.SERVER_ERROR(response.status));
  }

  const json: ApiResponse<FeedBatchResponseData> = await response.json();
  if (!json.success || !json.data?.items) {
    throw new Error(json.error || MESSAGES.FEED_FETCH_FAILED);
  }
  return json.data;
}

// RSS URL の接続テスト（HTTP ステータスに関わらずレスポンス本文を返す）
export async function validateFeedUrl(url: string): Promise<ApiResponse<FeedValidateResponseData>> {
  const response = await postJson(API_ROUTES.FEED_VALIDATE, { url });
  return response.json();
}
