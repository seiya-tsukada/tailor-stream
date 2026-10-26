# CLAUDE.md

## プロダクト概要

tailor-stream は、ユーザーが選んだカテゴリ（最大3つ）のニュースを、複数媒体の重複をまとめたうえでスコア順に届けるモバイルファーストの Web アプリ。
旧 Google アラートリーダー（AlertPulse）から公開版 MVP へ作り変えている途中。

- 仕様の正は `docs/SPEC.md`。このファイルや README と食い違う場合は SPEC.md に従う。
- DB スキーマの正は `supabase/migrations/20261027000000_tailor_stream_schema.sql`。
- 作業は PR 単位で進める（1PR＝1ブランチ）。

## 技術スタック

- フロントエンド: Vite + React 19 + Tailwind CSS v4（TypeScript、`src/`）
- バックエンド: Python 3.12 + FastAPI（`backend/`）。DB 操作・認証・記事取得・決済など責任を伴う処理はすべて Python で行う
- DB: Supabase を Postgres ホスティングとしてのみ使う（Supabase Auth / Data API / RLS / supabase-js は使わない）。
  全テーブルは `tailor_stream` スキーマ。アプリは専用ロール `tailor_stream_app` で Supavisor の Transaction mode（6543）に接続する
- ホスティング: Vercel。フロントは静的ビルド、`/api/*` は `api/index.py`（Python Function）にルーティング（`vercel.json`）
- テスト: フロントは vitest（対象ファイルと同じ場所に `*.test.ts`）、バックエンドは pytest（`tests/`）

## バックエンドの構成

- `backend/app.py`: FastAPI アプリ（ルーター登録・例外ハンドラ）
- `backend/config.py`: pydantic-settings で環境変数を読む（必須値が無ければ起動時にエラー）。固定の定数・エラーメッセージもここ
- `backend/db.py`: psycopg 3。`prepare_threshold=None` を必ず指定し、リクエスト単位で接続する（プールを使う場合も max 2 以下）
- `backend/models.py`: API の入出力（pydantic）。JSON はキャメルケース
- `backend/repositories/`: SQL はここだけに書く。ユーザーデータを扱う関数は `user_id` を必須引数にする
- `backend/feed/`: URL 正規化・記事 ID・サニタイズ・`NewsProvider` プロトコルと実装
- `backend/ingestion/`: 取得 → 正規化 → upsert → `ingestion_runs` 記録
- `backend/routes/`: ルーター。依存関数は `routes/deps.py`（テストでは `dependency_overrides` でフェイクに差し替える）
- `tests/`: pytest。DB を使うテストは `TEST_DATABASE_URL` があるときだけ実行し、それ以外は repositories をフェイクにする

## 型の共有

- API の型は FastAPI の OpenAPI から `npm run gen:api` で `src/api/schema.d.ts` を生成する。生成物はコミットする。
  バックエンドの入出力を変えたら必ず再生成する。フロントは `src/api/types.ts` の別名を使う

## 外部依存の扱い

- ニュース API・AI・決済・メール送信などの外部サービスはプロトコル（インターフェース）越しに使い、環境変数で実装を切り替える
- 呼び出し側はプロトコルにだけ依存させる

## コーディング規約

### 共通

- 定数・設定値はコードに直書きせず外出しする（サーバー: `backend/config.py`、クライアント: `src/config/`）
- 秘密情報（`DATABASE_URL`、各種キー）をログ・レスポンス・フロントのコードに出さない。`VITE_` 接頭辞を付けない
- カテゴリのシードは `supabase/seed.sql` と `backend/feed/categories.py` の2か所にあり、テストで一致を検証している。変えるときは両方を変更する

### Python

- 型ヒント必須。`mypy --strict` を通す。ruff で lint / format する
- SQL は必ずパラメータ化する（f-string や文字列連結で SQL を組み立てない）
- 例外は握りつぶさずログに残し、クライアントには固定のエラーコードとメッセージだけ返す（`backend/errors.py` の `AppError`）

### TypeScript

- `any` は使わない。外部入力や `catch` の値は `unknown` で受け、型ガードで絞り込む（メッセージの取り出しは `src/utils/errors.ts` の `getErrorMessage`）
- UI に出す文言は `src/config/messages.ts` に集約する
- 新しいファイルは既存のディレクトリ構成（`src/{api,components,hooks,services,config,utils}`）に従って置く

## ローカル開発

- `uvicorn backend.app:app --reload --port 8000` と `npm run dev`（Vite）を並行起動する。Vite が `/api` を `http://127.0.0.1:8000` に転送する
- 環境変数はリポジトリ直下の `.env`（gitignore 済み）から読む。項目を増やしたら `.env.example` も更新する

## 作業の完了条件

次のコマンドがすべて通ること。

```bash
npm run lint && npm test && ruff check . && ruff format --check . && mypy backend && pytest
```
