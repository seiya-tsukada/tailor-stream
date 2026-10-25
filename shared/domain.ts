/**
 * ドメイン型（docs/SPEC.md §4 のテーブルに対応）
 * - *Row: DB の行そのもの（スネークケース）。Supabase から受け取る・渡す形
 * - それ以外: アプリで扱う形（キャメルケース）。Row から型を導出しているので列の追加漏れが起きない
 * timestamptz は ISO 8601 文字列で扱う。
 */

// ---------------------------------------------------------------
// 列挙値
// ---------------------------------------------------------------

export const PLANS = ['free', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export const AI_CACHE_KINDS = ['summary', 'translation'] as const;
export type AiCacheKind = (typeof AI_CACHE_KINDS)[number];

export const INGESTION_STATUSES = ['running', 'succeeded', 'failed'] as const;
export type IngestionStatus = (typeof INGESTION_STATUSES)[number];

export const isPlan = (value: unknown): value is Plan => PLANS.some((plan) => plan === value);

// ---------------------------------------------------------------
// DB の行（スネークケース）
// ---------------------------------------------------------------

export interface CategoryRow {
  id: string;
  name_ja: string;
  name_en: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface StoryClusterRow {
  id: string;
  representative_article_id: string | null;
  source_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ArticleRow {
  id: string;
  provider: string;
  provider_article_id: string | null;
  canonical_url: string;
  title: string;
  snippet: string | null;
  source_name: string | null;
  source_domain: string;
  language: string;
  region: string | null;
  image_url: string | null;
  published_at: string;
  share_count: number | null;
  popularity_score: number;
  cluster_id: string | null;
  fetched_at: string;
  expires_at: string;
}

export interface ArticleCategoryRow {
  article_id: string;
  category_id: string;
}

export interface ProfileRow {
  user_id: string;
  plan: Plan;
  plan_expires_at: string | null;
  created_at: string;
}

export interface UserCategoryRow {
  user_id: string;
  category_id: string;
  created_at: string;
}

export interface UserSaveRow {
  user_id: string;
  article_id: string;
  saved_at: string;
  /** ピン留めは null */
  expires_at: string | null;
  is_pinned: boolean;
}

export interface AiCacheEntryRow {
  article_id: string;
  kind: AiCacheKind;
  /** 出力言語 */
  lang: string;
  content: string;
  model: string;
  created_at: string;
}

export interface IngestionRunRow {
  id: number;
  provider: string;
  category_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: IngestionStatus;
  fetched_count: number | null;
  /** API の消費単位（トークン・リクエスト数） */
  request_units: number | null;
  error: string | null;
}

// ---------------------------------------------------------------
// スネークケース ⇔ キャメルケース
// ---------------------------------------------------------------

type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
  : S;

type CamelToSnake<S extends string> = S extends `${infer Head}${infer Tail}`
  ? `${Head extends Lowercase<Head> ? Head : `_${Lowercase<Head>}`}${CamelToSnake<Tail>}`
  : S;

export type CamelCaseKeys<T> = { [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K] };
export type SnakeCaseKeys<T> = { [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K] };

const snakeToCamel = (key: string): string => key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
const camelToSnake = (key: string): string => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

/** DB の行をアプリの形に変換する（キーのみ変換し、値はそのまま） */
export function fromRow<T extends object>(row: T): CamelCaseKeys<T> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [snakeToCamel(key), value])) as CamelCaseKeys<T>;
}

/** アプリの形を DB の行に変換する（キーのみ変換し、値はそのまま） */
export function toRow<T extends object>(entity: T): SnakeCaseKeys<T> {
  return Object.fromEntries(Object.entries(entity).map(([key, value]) => [camelToSnake(key), value])) as SnakeCaseKeys<T>;
}

// ---------------------------------------------------------------
// アプリで扱う型（キャメルケース）
// ---------------------------------------------------------------

export type Category = CamelCaseKeys<CategoryRow>;
export type StoryCluster = CamelCaseKeys<StoryClusterRow>;
export type Article = CamelCaseKeys<ArticleRow>;
export type ArticleCategory = CamelCaseKeys<ArticleCategoryRow>;
export type Profile = CamelCaseKeys<ProfileRow>;
export type UserCategory = CamelCaseKeys<UserCategoryRow>;
export type UserSave = CamelCaseKeys<UserSaveRow>;
export type AiCacheEntry = CamelCaseKeys<AiCacheEntryRow>;
export type IngestionRun = CamelCaseKeys<IngestionRunRow>;
