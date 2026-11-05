# TailorStream

選んだカテゴリ（最大3つ）のニュースを、複数媒体の重複をまとめたうえでスコア順に届けるモバイルファーストの Web アプリです。
仕様は [docs/SPEC.md](docs/SPEC.md) を参照してください。

## 構成

| レイヤー | 技術 | 場所 |
| --- | --- | --- |
| フロントエンド | Vite + React 19 + Tailwind CSS v4（TypeScript） | `src/` |
| バックエンド | Python 3.12 + FastAPI + psycopg 3 | `backend/`（Vercel では `api/index.py`） |
| DB | Supabase（Postgres ホスティングのみ。`tailor_stream` スキーマ） | `supabase/` |
| ホスティング | Vercel（フロントは静的配信、`/api/*` は Python Function） | `vercel.json` |

```
/
├── api/index.py              # Vercel の Python Function（backend.app の app を公開するだけ）
├── backend/
│   ├── app.py                # FastAPI アプリ（ルーター登録・例外ハンドラ）
│   ├── config.py             # 環境変数（pydantic-settings）と定数
│   ├── db.py                 # psycopg 3 の接続（リクエスト単位、prepare_threshold=None）
│   ├── models.py             # API の入出力（camelCase の JSON）
│   ├── errors.py             # 固定のエラーコード
│   ├── auth/                 # マジックリンク認証・セッション・Origin チェック
│   ├── email/                # EmailSender（console / resend）
│   ├── repositories/         # SQL はここだけ
│   ├── feed/                 # URL 正規化・記事 ID・サニタイズ・NewsProvider と実装
│   ├── ingestion/            # 取得 → 正規化 → upsert → ingestion_runs 記録
│   └── routes/               # health, categories, feed, me, admin
├── tests/                    # pytest
├── src/
│   ├── api/                  # schema.d.ts（OpenAPI から生成）と型の別名
│   ├── components/ hooks/ services/ utils/ config/
│   └── App.tsx
├── supabase/
│   ├── migrations/           # スキーマ定義（正）
│   └── seed.sql              # カテゴリのシード
├── pyproject.toml            # Python の依存・ruff・mypy・pytest の設定
├── requirements.txt          # Vercel 用（pyproject と一致させる）
└── vercel.json
```

## API

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/health` | ヘルスチェック |
| GET | `/api/categories` | アクティブなカテゴリ一覧 |
| GET | `/api/feed?categories=ai,web3` | 選択カテゴリ（最大3件）の記事。ストーリーごとに代表1件、スコア降順。ログイン中はクエリではなくアカウントのカテゴリを使う |
| POST | `/api/auth/login-link` | ログインリンクをメールで送る（body `{ "email": "..." }`） |
| POST | `/api/auth/verify` | リンクのトークンでログインし、セッション Cookie `ts_session` を発行する |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/me` | ログイン中のユーザー（要ログイン） |
| GET / PUT | `/api/me/categories` | 選択カテゴリの取得・全件入れ替え（要ログイン。body `{ "categoryIds": [...] }`） |
| POST | `/api/admin/ingest` | 記事の取り込み（`Authorization: Bearer <ADMIN_SECRET>`。body `{ "categoryId": "ai" }` を省略すると全カテゴリ） |

ログインは任意です（未ログインでもカテゴリを選んで閲覧できます）。GET 以外のリクエストは、Origin ヘッダが `APP_BASE_URL` と一致しないと 403 になります（`/api/admin/*` を除く）。
エラーは `{"error": {"code": "...", "message": "..."}}` 形式で返します。API ドキュメントはローカルで `http://127.0.0.1:8000/api/docs` から見られます。

## ローカル開発

### Docker で起動する（推奨）

Docker（Compose v2.24 以降）があれば、DB・バックエンド・フロントをまとめて起動できます。`.env` は不要です。

```bash
docker compose up --build
```

| サービス | URL | 内容 |
| --- | --- | --- |
| frontend | http://localhost:5180 | Vite。`/api` を api に転送 |
| api | http://localhost:8000/api/docs | FastAPI（`--reload`） |
| db | `postgresql://postgres:postgres@localhost:54330/postgres` | Postgres 17。Supabase の代わり。データはボリューム `tailor-stream_db-data`（`/var/lib/docker/volumes/tailor-stream_db-data/_data`） |

- DB は初回起動時に `supabase/migrations/*.sql` と `supabase/seed.sql` を開発用 DB（`postgres`）とテスト用 DB（`tailor_stream_test`）に適用し、`tailor_stream_app` にローカル専用のパスワードを設定します（`docker/db/init.sh`）。
- マイグレーションを追加・変更したら `docker compose down -v && docker compose up` で DB を作り直します（データは消えます）。
- メールは送りません（`EMAIL_PROVIDER=console` 固定）。ログインリンクは `docker compose logs -f api` に出るので、それをブラウザで開きます。
- 記事の取り込み: `curl -X POST http://localhost:8000/api/admin/ingest -H "Authorization: Bearer local-admin-secret-0123456789"`
- 実 DB テスト: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54330/tailor_stream_test pytest`
- ポートが使用中なら `.env` に `WEB_PORT` / `API_PORT` / `DB_PORT` を書いて変えられます。`NEWS_PROVIDER` や `GOOGLE_ALERTS_FEEDS` も `.env` から api に渡ります（`DATABASE_URL`・`APP_BASE_URL`・`EMAIL_PROVIDER` などは compose 側の値が優先されます）。
- `package.json` / `pyproject.toml` の依存を変えたら `docker compose up --build -V` で作り直します。
- `docker-compose.yml` のパスワード・シークレットはローカル専用のダミー値です。本番では使いません。

### Docker を使わずに起動する

#### 1. 依存のインストール

```bash
npm install
```

```bash
python3.12 -m venv .venv && .venv/bin/pip install -e '.[dev]'
```

以降の Python コマンドは `source .venv/bin/activate` してから実行する前提です。

#### 2. DB の準備

`docker compose up -d db` でローカルの Postgres だけを起動し、`DATABASE_URL=postgresql://tailor_stream_app:tailor_stream_app_local@localhost:54330/postgres` を使うのが簡単です。
Supabase のプロジェクトを使う場合は、マイグレーションとシードを適用します。

```bash
psql "$ADMIN_DATABASE_URL" -f supabase/migrations/20261027000000_tailor_stream_schema.sql -f supabase/seed.sql
```

アプリ用ロールのログイン権限とパスワードは、リポジトリに秘密を置かないため SQL Editor で手動設定します。

```sql
alter role tailor_stream_app login password '<ランダムなパスワード>';
```

`tailor_stream` スキーマは Supabase の Exposed schemas に追加しないでください。

#### 3. 環境変数

`.env.example` を `.env` にコピーし、`DATABASE_URL`・`ADMIN_SECRET` を設定します（`APP_BASE_URL` は省略するとローカルの `http://localhost:5173`）。
`NEWS_PROVIDER=mock` なら何も設定しなくても、DB の代わりにメモリ上のストア（モック記事）で動きます。

#### 4. 起動（2つのターミナルで並行起動）

```bash
uvicorn backend.app:app --reload --port 8000
```

```bash
npm run dev
```

Vite（`http://localhost:5173`）が `/api` を `http://127.0.0.1:8000` に転送します。

#### 5. 記事を取り込んで表示する

```bash
curl -X POST http://127.0.0.1:8000/api/admin/ingest -H "Authorization: Bearer $ADMIN_SECRET"
```

`http://localhost:5173/?categories=ai,web3` を開くと、取り込んだ記事が表示されます（選択カテゴリは一時的に URL クエリで保持しています）。

ログインを試すときは、画面右上の「ログイン / 登録」からメールアドレスを送ります。`EMAIL_PROVIDER=console` ではメールは送られず、ログインリンクが uvicorn のログに出るので、それをブラウザで開きます。

`NEWS_PROVIDER=google_alerts_rss` にして `GOOGLE_ALERTS_FEEDS` にカテゴリごとの RSS URL を設定すると、Google アラートから取り込みます。

## 開発フロー

1. `main` から作業ブランチを切る（1PR＝1ブランチ）。
2. 実装し、「チェック」のコマンドがすべて通ることを確認する。
3. PR を作成する。
4. PR の動作確認は、その PR のブランチをチェックアウトしてローカルの docker compose で行う。

   ```bash
   docker compose up --build
   ```

   - http://localhost:5180 で画面を確認する。記事は「Docker で起動する」の取り込みコマンドで入れる。
   - ログインはメールを送らず、`docker compose logs -f api` に出るログインリンクで確認する。
   - マイグレーションを含む PR は `docker compose down -v && docker compose up --build` で DB を作り直してから確認する。
5. レビュー後に `main` へマージすると、Vercel の本番環境にデプロイされる。

環境は dev（ローカルの docker compose）と production（Vercel）の2つです。Vercel は `main` だけをデプロイし、それ以外のブランチ（PR を含む）のデプロイは `vercel.json` の `git.deploymentEnabled` で止めています。

## API の型を更新する

バックエンドの入出力モデルを変えたら、OpenAPI から TypeScript の型を生成し直してコミットします。

```bash
npm run gen:api
```

## チェック

```bash
npm run lint && npm test && ruff check . && ruff format --check . && mypy backend && pytest
```

実 DB を使うテスト（`tests/test_db.py`）は `TEST_DATABASE_URL` を設定したときだけ実行されます（マイグレーションとシードを適用済みの DB を指定してください。Docker の `tailor_stream_test` が使えます）。

## デプロイ（Vercel）

- Vercel は `main` へのマージ（push）だけを本番にデプロイします。ほかのブランチの Preview デプロイは `vercel.json` の `git.deploymentEnabled`（`"**": false, "main": true`）で作らないようにしています。
- リポジトリを Vercel にインポートすると、`vercel.json` に従ってフロントを `vite build` で静的配信し、`/api/*` を `api/index.py`（Python Function）にルーティングします。
- Environment Variables に `DATABASE_URL`・`ADMIN_SECRET`・`RESEND_API_KEY`・`EMAIL_FROM`（必要に応じて `NEWS_PROVIDER` など）を設定します。`VITE_` 接頭辞は付けません。
- `APP_BASE_URL` は通常不要です（Vercel が入れる `VERCEL_PROJECT_PRODUCTION_URL` から本番 URL を作ります）。独自ドメインを使うなど本番 URL が別のときだけ設定します。
- 足りない環境変数があっても起動は止まりません。`NEWS_PROVIDER=mock` なら DB 無しでモック記事を表示し、メール設定が無ければログインだけが使えなくなります（Functions のログに警告が出ます）。
- `EMAIL_PROVIDER=console` は localhost 以外では使われません（ログインリンクをログに出さないため）。
- `docker/`・`docker-compose.yml` はローカル専用で、`.vercelignore` でアップロード対象から外しています。本番の DB は Supabase（Supavisor の Transaction mode、ポート 6543、ユーザーは `tailor_stream_app`）です。
- デプロイ後、`https://<deployment>/api/health` が `{"status":"ok",...}` を返すことを確認します。
