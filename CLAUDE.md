# CLAUDE.md

## プロダクト概要

tailor-stream は、ユーザーが選んだカテゴリ（最大3つ）のニュースを、複数媒体の重複をまとめたうえでスコア順に届けるモバイルファーストの Web アプリ。
現在は旧 Google アラートリーダー（AlertPulse）から公開版 MVP へ作り変えている途中。

- 仕様の正は `docs/SPEC.md`。このファイルや README と食い違う場合は SPEC.md に従う。
- 作業は SPEC.md のフェーズ単位で進める（1フェーズ＝1ブランチ＝1PR）。

## 技術スタック

- サーバー: Express（`server.ts`、`server/`）。開発時は Vite をミドルウェアとして組み込む
- クライアント: Vite + React 19 + Tailwind CSS v4（`src/`）
- 共通: TypeScript（`shared/` にクライアント・サーバー共通の型と API 定義）
- テスト: vitest（テストは対象ファイルと同じ場所に `*.test.ts` で置く）

## 外部依存の扱い

ニュース API・Supabase・AI・決済などの外部サービスは、必ずインターフェース越しに使う。
現時点ではすべてモック実装のみとし、実サービスの SDK や API キーは追加しない。
実装を差し替えられるように、呼び出し側はインターフェースにだけ依存させる。

## コーディング規約

- `any` は使わない。外部入力や `catch` の値は `unknown` で受け、型ガードで絞り込む
- 定数・設定値はコードに直書きせず、config に外出しする（サーバー: `server/config.ts`、クライアント: `src/config/constants.ts`）
- UI に出す文言は `src/config/messages.ts` に集約する（サーバー側のメッセージは `server/config.ts` の `SERVER_MESSAGES`）
- 新しいファイルは既存のディレクトリ構成（`server/` / `shared/` / `src/{components,hooks,services,config,utils}`）に従って置く

## 作業の完了条件

次の2つが通ること。

```bash
npm run lint   # tsc --noEmit
npm test       # vitest run
```
