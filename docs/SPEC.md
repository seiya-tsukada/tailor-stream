# TailorStream 仕様書（公開版 MVP）

> このファイルはリポジトリの `docs/SPEC.md` に置き、Claude Code の各フェーズで参照させる。
> 未確定事項は「§9 未確定事項」にまとめてあり、そこに関わる実装は必ず差し替え可能な形（インターフェース＋モック）で作ること。

## 1. プロダクト概要

ユーザーが関心カテゴリを最大3つ選ぶと、国内外の「今読むべき記事」を重複なし・よく読まれている順に一覧表示するモバイルファーストの Web アプリ。

旧 AlertPulse（ユーザーが Google アラートの RSS URL を登録する方式）から、**運営キュレーション型**に転換する。記事の取得・整形・AI 処理はユーザー単位ではなく**カテゴリ単位**で行い、結果を全ユーザーで共有する。

### 価値の線引き

| 機能 | 匿名 | 無料アカウント | 有料（Pro） |
|---|---|---|---|
| カテゴリ選択（最大3つ） | ○（ブラウザに保持） | ○（DB に保持） | ○ |
| 記事一覧の閲覧 | ○ | ○ | ○ |
| 保存（6時間で自動消滅） | ○（ブラウザに保持） | ○（DB に保持） | ○ |
| ピン留め（永続保存） | × | × | ○ |
| AI サマリ | × | × | ○ |
| AI 翻訳（日本語以外の記事） | × | × | ○ |

「保存は6時間で消える」こと自体が価値。ピン留めはその対比として有料にする。

## 2. 用語

- **カテゴリ**: 運営が定義する関心分野（例: AI、Web3、スタートアップ）。ユーザーはここから選ぶ。
- **記事（Article）**: ニュースプロバイダから取得し、正規化した1記事。
- **ストーリー（Story Cluster）**: 同じ出来事を報じた記事のまとまり。一覧には**ストーリーごとに代表記事1件**だけを出す（＝重複なし）。
- **保存（Save）**: ユーザーが記事を手元に残す操作。期限は保存時刻から6時間。
- **ピン留め（Pin）**: 期限のない保存。Pro 限定。
- **人気度スコア**: 「よく読まれている」の代理指標。実際の PV はどの API からも取得できないため、SNS シェア数・同じストーリーを報じた媒体数・媒体の影響力・鮮度から算出する。

## 3. アーキテクチャ

```
[News Provider (未確定) ] ── NewsProvider インターフェース ── MockNewsProvider（現時点の実装）
            │
            ▼ 定期取得（ingestion job）
┌─────────────────────────────────────────────┐
│ Server (Express)                             │
│  ingestion: 取得 → 正規化 → クラスタリング   │
│             → スコアリング → 保存            │
│  api: /api/categories, /api/feed, ...       │
│  ai:  AiProvider インターフェース（Mock）    │
│  repositories: ArticleRepository（InMemory） │
└───────────────────┬─────────────────────────┘
                    │ JSON
┌───────────────────▼─────────────────────────┐
│ Client (React/Vite)                          │
│  UserDataRepository                          │
│   ├ LocalUserDataRepository（匿名）          │
│   └ MockRemoteUserDataRepository（ログイン） │
│     ※ 将来 SupabaseUserDataRepository に差替 │
│  AuthService（Mock）/ EntitlementService     │
└─────────────────────────────────────────────┘
```

- 記事取得はリクエスト時ではなく**定期バッチ**で行う。ユーザーのリクエストで外部 API を叩かない（コストと速度のため）。
- 外部依存（ニュース API・Supabase・AI・決済）はすべてインターフェース越しに使い、現時点はモック実装のみ。環境変数で実装を切り替える。

```
DATA_BACKEND=mock        # mock | supabase（supabase は未実装で起動時エラー）
NEWS_PROVIDER=mock       # mock | （確定後に追加）
AI_PROVIDER=mock         # mock | （確定後に追加）
INGEST_INTERVAL_MINUTES=120
```

## 4. データモデル（Supabase / PostgreSQL）

SQL は `supabase/migrations/` に置く。**現時点では適用しない**（契約前）。ただし構文的に正しく、そのまま `supabase db push` できる品質で書く。

```sql
-- カテゴリ（運営管理）
create table categories (
  id          text primary key,              -- 'ai', 'web3' など slug
  name_ja     text not null,
  name_en     text not null,
  description text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

-- ストーリー（重複記事のまとまり）
create table story_clusters (
  id                     text primary key,
  representative_article_id text,            -- articles.id（循環参照のため FK は後付け）
  source_count           int not null default 1,   -- 報じた媒体数
  first_seen_at          timestamptz not null default now(),
  last_seen_at           timestamptz not null default now()
);

-- 記事（全ユーザー共有）
create table articles (
  id                  text primary key,      -- 正規化 URL の SHA-256（先頭 32 文字）
  provider            text not null,         -- 'mock' など
  provider_article_id text,
  canonical_url       text not null unique,
  title               text not null,
  snippet             text,                  -- プロバイダ提供の概要のみ。本文は保存しない
  source_name         text,
  source_domain       text not null,
  language            text not null,         -- 'ja', 'en' ...
  region              text,                  -- 'jp', 'global' ...
  image_url           text,
  published_at        timestamptz not null,
  share_count         int,                   -- 取得できない場合は null
  popularity_score    double precision not null default 0,
  cluster_id          text references story_clusters(id),
  fetched_at          timestamptz not null default now(),
  expires_at          timestamptz not null    -- 一覧から外す時刻（例: 公開から 48h）
);
create index on articles (cluster_id);
create index on articles (published_at desc);

-- 記事とカテゴリの対応（1記事が複数カテゴリに属しうる）
create table article_categories (
  article_id  text references articles(id) on delete cascade,
  category_id text references categories(id),
  primary key (article_id, category_id)
);

-- ユーザープロフィール（auth.users と 1:1）
create table profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  plan            text not null default 'free' check (plan in ('free','pro')),
  plan_expires_at timestamptz,
  created_at      timestamptz not null default now()
);

-- ユーザーの選択カテゴリ（最大3件）
create table user_categories (
  user_id     uuid references auth.users(id) on delete cascade,
  category_id text references categories(id),
  created_at  timestamptz not null default now(),
  primary key (user_id, category_id)
);
-- 最大3件制約はトリガーで実装（insert 時に件数チェック）

-- 保存・ピン留め
create table user_saves (
  user_id    uuid references auth.users(id) on delete cascade,
  article_id text references articles(id),
  saved_at   timestamptz not null default now(),
  expires_at timestamptz,                    -- ピン留めは null
  is_pinned  boolean not null default false,
  primary key (user_id, article_id),
  check ((is_pinned and expires_at is null) or (not is_pinned and expires_at is not null))
);
-- ピン留めは profiles.plan = 'pro'（かつ期限内）のときだけ許可：トリガー or RLS の with check で強制

-- AI 生成結果の共有キャッシュ
create table article_ai_cache (
  article_id text references articles(id) on delete cascade,
  kind       text not null check (kind in ('summary','translation')),
  lang       text not null,                  -- 出力言語
  content    text not null,
  model      text not null,
  created_at timestamptz not null default now(),
  primary key (article_id, kind, lang)
);

-- 取得ジョブの記録（API コスト監視用）
create table ingestion_runs (
  id            bigserial primary key,
  provider      text not null,
  category_id   text references categories(id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null check (status in ('running','succeeded','failed')),
  fetched_count int,
  request_units int,                         -- API の消費単位（トークン・リクエスト数）
  error         text
);
```

### RLS 方針

- `categories` / `articles` / `article_categories` / `story_clusters` / `article_ai_cache`: 全員 select 可、書き込みは service role のみ。
- `profiles` / `user_categories` / `user_saves`: 本人の行のみ select / insert / update / delete 可。`profiles.plan` はユーザーが更新できない（決済 webhook = service role のみ）。

### 削除ジョブ（pg_cron 想定、モックでは setInterval）

- `user_saves`: `expires_at < now()` の行を削除。
- `articles`: `expires_at < now()` かつ**どの `user_saves` からも参照されていない**行を削除（ピン留めされた記事は残す）。
- 表示側でも `expires_at` で必ずフィルタする（削除ジョブの遅れに依存しない）。

## 5. 記事の取得・重複除去・スコアリング

### 取得

- カテゴリごとに `NewsProvider.fetchArticles(category, since)` を呼ぶ。
- 1 回の取得ごとに `ingestion_runs` に記録（消費単位を含む）。API 選定時の金額試算に使う。

### 正規化

- URL 正規化: スキーム・ホストを小文字化、`utm_*` などトラッキングパラメータ・フラグメント・末尾スラッシュを除去。
- 記事 ID: 正規化 URL の SHA-256 先頭 32 文字。
- タイトル・概要は既存の `sanitizeHtml` を通す。

### 重複除去（クラスタリング）

- プロバイダがクラスタ ID を返す場合はそれを優先して使う。
- 返さない場合は自前で判定: 正規化 URL 一致 → 同一記事。タイトルを正規化（小文字化・記号除去・トークン化）し、Jaccard 類似度が閾値（初期値 0.6、設定可能）以上かつ公開時刻差が 48h 以内なら同一ストーリー。
- 日本語タイトルは文字 bi-gram で比較する（分かち書き不要）。
- ストーリーの代表記事は、スコアが最も高い記事。

### 人気度スコア

```
score = w_share  * log1p(share_count ?? 0)
      + w_source * log1p(cluster.source_count - 1)
      + w_trust  * source_weight(domain)       -- 媒体ごとの重み（設定ファイル、未登録は 1.0）
      - w_decay  * hours_since_published
```

- 重みはすべて設定ファイルに外出しする（初期値は実装時に妥当な値を置き、テストで順位が意図通りになることを確認する）。
- 一覧: 選択カテゴリの記事を `expires_at > now()` で絞り、ストーリー単位でまとめてスコア降順。

## 6. 保存・ピン留め

- 保存: `expires_at = saved_at + 6h`。期限はサーバー時刻基準（匿名はクライアント時刻で可）。
- カード上に残り時間を表示（「あと 4時間12分」）。残り 30 分未満は警告色。
- 期限切れの保存は一覧から自動で消える（クライアントでも 1 分ごとに再評価）。
- ピン留め: Pro のみ。無料ユーザーが押した場合は Pro 案内を表示（エラーにしない）。
- Pro 解約時: 既存のピン留めは閲覧可能なまま残すが、新規ピン留めは不可（方針。変更しやすく実装する）。
- 匿名 → アカウント登録時: ブラウザに保持していたカテゴリと**期限内の保存**をアカウントへ移行する。

## 7. AI サマリ・翻訳

- 入力は**タイトルとプロバイダ提供の概要のみ**。本文を取得して要約しない（著作権配慮）。
- サマリは日本語で 120 文字以内。元記事リンクを常に主役として表示する。
- 翻訳は `language !== 'ja'` の記事のタイトル・概要を日本語へ。
- 結果は `article_ai_cache` に保存し、全 Pro ユーザーで共有。同じ記事・種類・言語で 2 回生成しない。
- 生成はユーザーが初めて開いたときにオンデマンドで行う（事前一括生成はしない）。

## 8. 認証・課金（モック）

- `AuthService`: `signInWithEmail(email)` で即ログイン扱いになるモック。将来 Supabase Auth に差し替え。
- `EntitlementService`: `getPlan(userId)` を返すモック。開発時のみ表示されるデバッグパネルで free / pro を切り替えられる。
- 決済（Stripe 想定）は未実装。UI 上の「Pro にアップグレード」はモーダルで「準備中」を表示。

## 9. 未確定事項（差し替え前提で作る）

| 項目 | 現状 | 確定後にやること |
|---|---|---|
| ニュース API | 未選定（NewsAPI.ai / Mediastack 等を金額で比較中） | `NewsProvider` 実装を1ファイル追加 |
| DB | Supabase 未契約 | `SupabaseUserDataRepository` / `SupabaseArticleRepository` 実装、migrations 適用 |
| AI | 未選定 | `AiProvider` 実装を追加 |
| 決済 | 未選定（Stripe 想定） | webhook で `profiles.plan` を更新 |
| アプリ名 | 仮に TailorStream | `APP_INFO` を変更 |
| カテゴリ一覧 | 仮のシード | `categories` シードを差し替え |
