# TailorStream 仕様書（公開版 MVP）

> このファイルはリポジトリの `docs/SPEC.md` に置き、Claude Code の各フェーズで参照させる。
> 未確定事項は「§9 未確定事項」にまとめてあり、そこに関わる実装は必ず差し替え可能な形（プロトコル＋モック）で作ること。

## 1. プロダクト概要

ユーザーが関心カテゴリを最大3つ選ぶと、国内外の「今読むべき記事」を重複なし・よく読まれている順に一覧表示するモバイルファーストの Web アプリ。

旧 AlertPulse（ユーザーが Google アラートの RSS URL を登録する方式）から、**運営キュレーション型**に転換する。記事の取得・整形・AI 処理はユーザー単位ではなく**カテゴリ単位**で行い、結果を全ユーザーで共有する。

### 価値の線引き

アカウント登録は任意。未ログインでもカテゴリを選んで記事一覧を読める。ログインすると選択カテゴリがアカウント（DB）に保存され、どの端末でも同じ設定で使える。

| 機能 | 未ログイン | 無料アカウント | 有料（Pro） |
|---|---|---|---|
| カテゴリ選択（最大3つ） | ○（URL クエリに保持） | ○（DB に保持） | ○ |
| 記事一覧の閲覧 | ○ | ○ | ○ |
| 保存（6時間で自動消滅） | ×（ログインが必要） | ○（DB に保持） | ○ |
| ピン留め（永続保存） | × | × | ○ |
| AI サマリ | × | × | ○ |
| AI 翻訳（日本語以外の記事） | × | × | ○ |

- 未ログインで選んでいたカテゴリは、ログイン時にアカウントのカテゴリが未設定ならアカウントへ移す（設定済みなら上書きしない）。

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
[News Provider] ── NewsProvider プロトコル ─┬ MockNewsProvider（開発用）
                                          └ GoogleAlertsRssProvider（feedparser + httpx）
            │
            ▼ 取り込み（今は管理 API から手動。定期実行の仕組みは後で決める）
┌──────────────────────────────────────────────────┐
│ Backend: Python 3.12 + FastAPI（backend/）         │
│  Vercel の Python Function（api/index.py）で動かす │
│  ingestion: 取得 → 正規化 → upsert → 実行記録      │
│  routes:    /api/health, /api/categories, /api/feed│
│             /api/auth/*, /api/me/*, /api/admin/*   │
│  auth:      マジックリンク + セッション Cookie      │
│  repositories: SQL はここだけ（psycopg 3）         │
└───────────────┬──────────────────┬───────────────┘
                │ JSON（camelCase）  │ Supavisor Transaction mode（6543）
┌───────────────▼────────────┐  ┌──▼─────────────────────────────┐
│ Frontend: Vite + React 19  │  │ Supabase（Postgres ホスティングのみ）│
│ （src/、Vercel の静的配信）  │  │ tailor_stream スキーマ             │
│ 型は OpenAPI から生成       │  │ ロール tailor_stream_app で接続    │
└────────────────────────────┘  └────────────────────────────────┘
```

- DB 操作・認証・記事取得・決済など責任を伴う処理はすべてバックエンド（Python）で行う。フロントは API だけを呼ぶ。
- Supabase は Postgres ホスティングとしてのみ使う。Supabase Auth / Data API / RLS / supabase-js は使わない。
- 記事取得はリクエスト時ではなく取り込みジョブで行う。ユーザーのリクエストで外部 API を叩かない（コストと速度のため）。
- 外部依存（ニュース API・AI・決済・メール送信）はプロトコル越しに使い、環境変数で実装を切り替える。
- Vercel では vercel.json で `/api/*` をすべて `api/index.py` にルーティングする。
- API の型は FastAPI の OpenAPI から `npm run gen:api` で `src/api/schema.d.ts` を生成する（生成物はコミットする）。

```
DATABASE_URL=...          # 必須。tailor_stream_app で Transaction mode（6543）に接続
ADMIN_SECRET=...          # 必須。/api/admin/* の Bearer トークン
NEWS_PROVIDER=mock        # mock | google_alerts_rss
GOOGLE_ALERTS_FEEDS={...} # カテゴリ ID → RSS URL（JSON）。未設定のカテゴリはスキップ
ARTICLE_TTL_HOURS=48      # articles.expires_at = published_at + この時間
APP_BASE_URL=...          # 必須。フロントの URL（ログインリンク・Origin チェック・Cookie の Secure 判定）
SESSION_TTL_DAYS=30       # セッションの有効期限
EMAIL_PROVIDER=console    # console（ローカル開発のみ）| resend（RESEND_API_KEY・EMAIL_FROM が必要）
```

## 4. データモデル（Supabase / PostgreSQL）

スキーマ定義の正は `supabase/migrations/20261027000000_tailor_stream_schema.sql`。仕様書には要点だけを書く。

- 全オブジェクトを `tailor_stream` スキーマに置く。このスキーマは Supabase の Exposed schemas に追加しない（Data API から見せない）。
- アプリは専用ロール `tailor_stream_app` で接続する（search_path・statement_timeout はロールに設定済み。ログイン権限とパスワードは SQL Editor で手動設定し、リポジトリには置かない）。DDL の権限は持たない。
- テーブル:
  - 共有データ: `categories` / `story_clusters` / `articles` / `article_categories` / `article_ai_cache` / `ingestion_runs`
  - アカウント・認証: `users`（plan もここで持つ）/ `login_tokens` / `sessions`（トークンは SHA-256 のみ保存）
  - ユーザーデータ: `user_categories` / `user_saves`
- アプリのバグがあっても DB 側で不正を止めるトリガー:
  - `user_categories` は1ユーザー最大3件（超えると `hint = 'category_limit_exceeded'`）
  - `user_saves` の `expires_at` はサーバー時刻で `saved_at + 6h` に上書き。新たなピン留めは Pro かつ期限内のみ（違反は `hint = 'pro_required'`）
- カテゴリのシードは `supabase/seed.sql`。`backend/feed/categories.py` と一致することをテストで検証している。

### 削除ジョブ

DB 関数として用意し、呼び出し元（管理 API / pg_cron など）は後で決める。

- `cleanup_expired_saves()`: 期限切れの保存を削除。
- `cleanup_expired_articles()`: 掲載期限切れで、どの保存からも参照されていない記事を削除（ピン留めされた記事は残す）。空になったストーリーも削除。
- `cleanup_expired_auth()`: 期限切れ・失効済みのセッションと期限切れのログイントークンを削除。
- 表示側でも `expires_at` で必ずフィルタする（削除ジョブの遅れに依存しない）。

## 5. 記事の取得・重複除去・スコアリング

### 取得

- カテゴリごとに `NewsProvider.fetch_articles(category)` を呼ぶ。プロバイダが対応しないカテゴリ（例: RSS URL 未設定）はスキップする。
- 1 回の取得ごとに `ingestion_runs` に記録（消費単位を含む）。API 選定時の金額試算に使う。

### 正規化

- URL 正規化: スキーム・ホストを小文字化、`utm_*` などトラッキングパラメータ・フラグメント・末尾スラッシュを除去。
- 記事 ID: 正規化 URL の SHA-256 先頭 32 文字。
- タイトル・概要は `sanitize_html` を通す。Google アラートの転送 URL は元の URL に戻してから正規化する。

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
- 一覧: 選択カテゴリの記事を `expires_at > now()` で絞り、ストーリー単位で代表1件にまとめて `popularity_score` 降順 → `published_at` 降順。
- 現状はクラスタリング未実装（`cluster_id` が null の記事は1件で1ストーリー）で、スコアはシェア数の項だけを使う。

## 6. 保存・ピン留め

- 保存: `expires_at = saved_at + 6h`。期限はサーバー時刻基準（DB トリガーで強制）。
- カード上に残り時間を表示（「あと 4時間12分」）。残り 30 分未満は警告色。
- 期限切れの保存は一覧から自動で消える（クライアントでも 1 分ごとに再評価）。
- ピン留め: Pro のみ。無料ユーザーが押した場合は Pro 案内を表示（エラーにしない）。
- Pro 解約時: 既存のピン留めは閲覧可能なまま残すが、新規ピン留めは不可（方針。変更しやすく実装する）。

## 7. AI サマリ・翻訳

- 入力は**タイトルとプロバイダ提供の概要のみ**。本文を取得して要約しない（著作権配慮）。
- サマリは日本語で 120 文字以内。元記事リンクを常に主役として表示する。
- 翻訳は `language !== 'ja'` の記事のタイトル・概要を日本語へ。
- 結果は `article_ai_cache` に保存し、全 Pro ユーザーで共有。同じ記事・種類・言語で 2 回生成しない。
- 生成はユーザーが初めて開いたときにオンデマンドで行う（事前一括生成はしない）。

## 8. 認証・課金

### 認証（メールのマジックリンク）

認証ライブラリに頼らず、最小実装を `backend/auth/` に置く。パスワードは持たない。

- `POST /api/auth/login-link { email }`: email を正規化（前後空白除去・小文字化・形式検証）し、ログイン用トークンをメールで送る。
  - 登録済みかどうかに関係なく常に同じレスポンスを返す（アカウント存在の推測を防ぐ）。
  - レート制限: 同一メール 15 分に 3 回、同一 IP 1 時間に 10 回まで（`login_tokens` の件数で判定）。IP は `x-forwarded-for` の先頭。
  - トークンは `secrets.token_urlsafe(32)`、DB には SHA-256 のみ保存。有効期限 15 分。リンクはフロントの `/auth/verify?token=...`。
- `POST /api/auth/verify { token }`: リンクスキャナーの GET で消費されないよう、検証はフロントからの POST で行う。1文の UPDATE で原子的に消費し、`users` を upsert、セッションを作成。
- セッション: Cookie `ts_session`（HttpOnly、本番は Secure、SameSite=Lax、Path=/）。DB には SHA-256 のみ保存。有効期限 `SESSION_TTL_DAYS`（既定 30 日）。
- `POST /api/auth/logout`、`GET /api/me`。
- CSRF 対策: GET 以外のリクエストは Origin ヘッダが `APP_BASE_URL` と一致しなければ 403（`/api/admin/*` を除く）。
- メール送信: `EmailSender` プロトコル。`EMAIL_PROVIDER=console | resend`。
- ログインは任意。API ごとの扱い:
  - ログイン不要: `/api/health`、`/api/categories`、`/api/auth/*`
  - ログイン任意: `GET /api/feed`（ログイン中はユーザーの選択カテゴリ、未ログインはクエリ `?categories=` を使う。未選択なら空の一覧）
  - ログイン必須（未ログインは 401）: `/api/me`、`/api/me/categories`（以後の保存・ピン留めなどユーザーデータの API も同様）
  - `/api/admin/*` は `ADMIN_SECRET` の Bearer トークン（Cookie を使わないため Origin チェックの対象外）
- `EMAIL_PROVIDER=console`（ログインリンクをログに出す）はローカル開発（`APP_BASE_URL` が localhost）でのみ使える。

### 課金

- プランは `users.plan` / `users.plan_expires_at` で持つ。変更は決済 webhook の処理からのみ行う。
- 決済（Stripe 想定）は未実装。UI 上の「Pro にアップグレード」はモーダルで「準備中」を表示。
- 開発時の Pro 切り替えは SQL で `users.plan` を更新して確認する（デバッグパネルは作らない）。

## 9. 未確定事項（差し替え前提で作る）

| 項目 | 現状 | 確定後にやること |
|---|---|---|
| ニュース API | 未選定（NewsAPI.ai / Mediastack 等を金額で比較中）。当面は Google アラートの RSS | `NewsProvider` 実装を1ファイル追加 |
| AI | 未選定 | `AiProvider` 実装を追加 |
| 定期取り込み | 未定（今は `POST /api/admin/ingest` で手動） | Vercel Cron / pg_cron / 外部スケジューラから呼ぶ |
| 決済 | 未選定（Stripe 想定） | webhook で `users.plan` を更新 |
| アプリ名 | 仮に TailorStream | `src/config/constants.ts` の `APP_INFO` を変更 |
| カテゴリ一覧 | 仮のシード | `categories` シードを差し替え |
