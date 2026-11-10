-- 全ユーザーとそのデータを削除する
-- 対象: users と、そこから cascade する sessions / user_categories / user_saves、およびログイントークン（login_tokens）
-- 残す: カテゴリ・記事などの共有データ
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=yes -f supabase/maintenance/truncate_users.sql
--
-- -v confirm=yes が無いと何もせずに止まる。

\if :{?confirm}
\else
  \echo 'truncate_users.sql: 全ユーザーとそのデータを削除します。-v confirm=yes を付けて再実行してください'
  do $$ begin raise exception 'confirmation required (-v confirm=yes)'; end $$;
\endif

begin;

select count(*) as users_before from tailor_stream.users;

truncate table tailor_stream.users, tailor_stream.login_tokens restart identity cascade;

select count(*) as users_after from tailor_stream.users;

commit;
