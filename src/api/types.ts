/**
 * API の型（src/api/schema.d.ts は `npm run gen:api` で FastAPI の OpenAPI から生成する）
 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type Category = Schemas['CategoryOut'];
export type Article = Schemas['ArticleOut'];
export type FeedResponse = Schemas['FeedResponse'];
export type ErrorResponse = Schemas['ErrorResponse'];
export type ErrorCode = Schemas['ErrorCode'];
