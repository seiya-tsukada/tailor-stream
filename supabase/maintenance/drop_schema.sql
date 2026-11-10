-- tailor_stream スキーマごと削除する（テーブル・データ・関数・トリガーすべて）
-- 単体でも使えるが、マイグレーションとシードの前に連結すると作り直しになる:
--
--   cat supabase/maintenance/drop_schema.sql supabase/migrations/*.sql supabase/seed.sql \
--     | psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=yes -1
--
-- -v confirm=yes が無いと何もせずに止まる。

\if :{?confirm}
\else
  \echo 'drop_schema.sql: tailor_stream スキーマを全データごと削除します。-v confirm=yes を付けて再実行してください'
  do $$ begin raise exception 'confirmation required (-v confirm=yes)'; end $$;
\endif

drop schema if exists tailor_stream cascade;
