-- 1ユーザーとそのデータを削除する
-- （sessions / user_categories / user_saves は users から cascade。login_tokens はメールで紐づくので個別に消す）
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v email=someone@example.com -f supabase/maintenance/delete_user.sql

\if :{?email}
\else
  \echo 'delete_user.sql: 削除するメールアドレスを -v email=someone@example.com で指定してください'
  do $$ begin raise exception 'email is required (-v email=...)'; end $$;
\endif

begin;

delete from tailor_stream.login_tokens
where email = lower(:'email');

delete from tailor_stream.users
where email = lower(:'email')
returning id, email;

commit;
