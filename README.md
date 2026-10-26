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
│   ├── repositories/         # SQL はここだけ
│   ├── feed/                 # URL 正規化・記事 ID・サニタイズ・NewsProvider と実装
│   ├── ingestion/            # 取得 → 正規化 → upsert → ingestion_runs 記録
│   └── routes/               # health, categories, feed, admin
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
| GET | `/api/feed?categories=ai,web3` | 選択カテゴリ（最大3件）の記事。ストーリーごとに代表1件、スコア降順 |
| POST | `/api/admin/ingest` | 記事の取り込み（`Authorization: Bearer <ADMIN_SECRET>`。body `{ "categoryId": "ai" }` を省略すると全カテゴリ） |

エラーは `{"error": {"code": "...", "message": "..."}}` 形式で返します。API ドキュメントはローカルで `http://127.0.0.1:8000/api/docs` から見られます。

## ローカル開発

### 1. 依存のインストール

```bash
npm install
```

```bash
python3.12 -m venv .venv && .venv/bin/pip install -e '.[dev]'
```

以降の Python コマンドは `source .venv/bin/activate` してから実行する前提です。

### 2. DB の準備

Supabase のプロジェクト（またはローカルの Postgres）に、マイグレーションとシードを適用します。

```bash
psql "$ADMIN_DATABASE_URL" -f supabase/migrations/20261027000000_tailor_stream_schema.sql -f supabase/seed.sql
```

アプリ用ロールのログイン権限とパスワードは、リポジトリに秘密を置かないため SQL Editor で手動設定します。

```sql
alter role tailor_stream_app login password '<ランダムなパスワード>';
```

`tailor_stream` スキーマは Supabase の Exposed schemas に追加しないでください。

### 3. 環境変数

`.env.example` を `.env` にコピーし、`DATABASE_URL`（Supavisor の Transaction mode、ポート 6543、ユーザーは `tailor_stream_app`）と `ADMIN_SECRET` を設定します。

### 4. 起動（2つのターミナルで並行起動）

```bash
uvicorn backend.app:app --reload --port 8000
```

```bash
npm run dev
```

Vite（`http://localhost:5173`）が `/api` を `http://127.0.0.1:8000` に転送します。

### 5. 記事を取り込んで表示する

```bash
curl -X POST http://127.0.0.1:8000/api/admin/ingest -H "Authorization: Bearer $ADMIN_SECRET"
```

`http://localhost:5173/?categories=ai,web3` を開くと、取り込んだ記事が表示されます（選択カテゴリは一時的に URL クエリで保持しています）。

`NEWS_PROVIDER=google_alerts_rss` にして `GOOGLE_ALERTS_FEEDS` にカテゴリごとの RSS URL を設定すると、Google アラートから取り込みます。

## API の型を更新する

バックエンドの入出力モデルを変えたら、OpenAPI から TypeScript の型を生成し直してコミットします。

```bash
npm run gen:api
```

## チェック

```bash
npm run lint && npm test && ruff check . && ruff format --check . && mypy backend && pytest
```

実 DB を使うテスト（`tests/test_db.py`）は `TEST_DATABASE_URL` を設定したときだけ実行されます（マイグレーションとシードを適用済みの DB を指定してください）。

## デプロイ（Vercel）

- リポジトリを Vercel にインポートすると、`vercel.json` に従ってフロントを `vite build` で静的配信し、`/api/*` を `api/index.py`（Python Function）にルーティングします。
- Environment Variables に `DATABASE_URL` と `ADMIN_SECRET`（必要に応じて `NEWS_PROVIDER` など）を設定します。`VITE_` 接頭辞は付けません。
- デプロイ後、`https://<deployment>/api/health` が `{"status":"ok",...}` を返すことを確認します。
