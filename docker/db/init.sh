#!/bin/sh
# ローカル開発用 DB の初期化（docker compose の db コンテナが初回起動時に1回だけ実行する）
#
# - 開発用 DB（POSTGRES_DB）とテスト用 DB（TAILOR_STREAM_TEST_DB）の両方に
#   supabase/migrations/*.sql（ファイル名順）と supabase/seed.sql を適用する
# - アプリ用ロール tailor_stream_app にローカル専用のパスワードでログイン権限を付ける
#   （本番の Supabase では SQL Editor で手動設定する。README 参照）
set -eu

MIGRATIONS_DIR=/tailor-stream/migrations
SEED_FILE=/tailor-stream/seed.sql

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "create database \"$TAILOR_STREAM_TEST_DB\""

for db in "$POSTGRES_DB" "$TAILOR_STREAM_TEST_DB"; do
  echo "[init] $db にマイグレーションとシードを適用します"
  for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -f "$file"
  done
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -f "$SEED_FILE"
done

# ロールはクラスタ共通なので1回だけ設定する
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$TAILOR_STREAM_APP_PASSWORD" <<'SQL'
alter role tailor_stream_app login password :'app_password';
SQL
