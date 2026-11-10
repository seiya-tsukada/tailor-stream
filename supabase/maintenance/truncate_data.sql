-- カテゴリ（運営管理のマスタ）以外の全データを削除する
-- テーブル・制約・関数・トリガーは残す。カテゴリも消したいときは drop_schema.sql で作り直す。
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=yes -f supabase/maintenance/truncate_data.sql
--
-- -v confirm=yes が無いと何もせずに止まる。

\if :{?confirm}
\else
  \echo 'truncate_data.sql: カテゴリ以外の tailor_stream の全データを削除します。-v confirm=yes を付けて再実行してください'
  do $$ begin raise exception 'confirmation required (-v confirm=yes)'; end $$;
\endif

do $$
declare
  tables text;
begin
  select string_agg(format('tailor_stream.%I', tablename), ', ' order by tablename)
    into tables
  from pg_tables
  where schemaname = 'tailor_stream'
    and tablename <> 'categories';

  if tables is not null then
    execute 'truncate table ' || tables || ' restart identity';
    raise notice 'truncated: %', tables;
  end if;
end;
$$;
