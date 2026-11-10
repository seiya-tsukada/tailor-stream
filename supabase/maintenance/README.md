# メンテナンス用 SQL

運用・開発中に手で流す SQL。アプリ（`tailor_stream_app`）ではなく、DB のオーナー権限（ローカルは `postgres`、Supabase は SQL Editor か接続文字列の `postgres` ユーザー）で実行する。

| ファイル | 内容 | 確認 |
| --- | --- | --- |
| `row_counts.sql` | 全テーブルの件数（読み取りのみ） | 不要 |
| `purge_expired.sql` | 期限切れの保存・記事・セッション・ログイントークンを削除（`cleanup_expired_*()` を呼ぶ） | 不要 |
| `delete_user.sql` | 1ユーザーとそのデータを削除 | `-v email=...` |
| `truncate_articles.sql` | 記事・ストーリー・AI キャッシュ・取り込み記録を全削除（保存も消える）。カテゴリとユーザーは残す | `-v confirm=yes` |
| `truncate_users.sql` | 全ユーザーとそのデータ（セッション・選択カテゴリ・保存）とログイントークンを全削除 | `-v confirm=yes` |
| `truncate_data.sql` | カテゴリ以外の全データを削除（テーブル・関数・トリガーは残す） | `-v confirm=yes` |
| `drop_schema.sql` | `tailor_stream` スキーマごと削除（ロール `tailor_stream_app` は残す） | `-v confirm=yes` |

```bash
# Supabase（ADMIN_DATABASE_URL はオーナー権限の接続文字列）
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/maintenance/row_counts.sql

# ローカルの docker compose（db コンテナに /tailor-stream/maintenance としてマウントしている）
docker compose exec db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tailor-stream/maintenance/row_counts.sql
```

スキーマを作り直す（全データが消える）:

```bash
cat supabase/maintenance/drop_schema.sql supabase/migrations/*.sql supabase/seed.sql \
  | psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=yes -1
```

確認が必要なファイルは `-v confirm=yes`（または `-v email=...`）を付けないとエラーで止まり、何も変更しない。
