#!/bin/sh
# ローカル開発用 DB のマイグレーション（docker compose の migrate サービスが起動のたびに実行する）
#
# - テスト用 DB（TAILOR_STREAM_TEST_DB）が無ければ作る
# - 開発用 DB（POSTGRES_DB）とテスト用 DB の両方に supabase/migrations/*.sql（ファイル名順）と
#   supabase/seed.sql を適用する。どちらも冪等なので、毎回流しても既存のデータは変わらない
#   （1ファイル = 1トランザクション。失敗したファイルは丸ごと戻る）
set -eu

MIGRATIONS_DIR=/tailor-stream/migrations
SEED_FILE=/tailor-stream/seed.sql

# 2回目以降の適用で出る「already exists, skipping」などの NOTICE は出さない
export PGOPTIONS="-c client_min_messages=warning"

run_psql() {
  psql -v ON_ERROR_STOP=1 -q "$@"
}

run_psql --dbname "$POSTGRES_DB" -v db="$TAILOR_STREAM_TEST_DB" <<'SQL'
select format('create database %I', :'db')
where not exists (select 1 from pg_database where datname = :'db')
\gexec
SQL

for db in "$POSTGRES_DB" "$TAILOR_STREAM_TEST_DB"; do
  for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    echo "[migrate] $db <- $(basename "$file")"
    run_psql --dbname "$db" --single-transaction -f "$file"
  done
  echo "[migrate] $db <- seed.sql"
  run_psql --dbname "$db" --single-transaction -f "$SEED_FILE"
done

echo "[migrate] 完了"
