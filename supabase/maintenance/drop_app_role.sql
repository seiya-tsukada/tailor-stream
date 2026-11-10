-- 旧構成のアプリ用ロール tailor_stream_app を削除する（一度だけ流せばよい。何度流しても安全）
-- アプリはオーナーロールで接続するようになったので不要。旧版の init.sql を流した DB にだけ残っている。
--
-- Supabase の postgres は superuser ではなく、tailor_stream_app のメンバーでもないため
-- drop owned by は使えない（permission denied to drop objects）。代わりに、旧版の init.sql が
-- 付与した権限を1つずつ取り消してから削除する（どれもオーナーである postgres が付与したもの）。
-- ロールはクラスタ共通だが権限は DB ごとなので、複数の DB に旧版を流した場合
-- （ローカルの postgres と tailor_stream_test など）は、それぞれの DB で流す。
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/maintenance/drop_app_role.sql

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'tailor_stream_app') then
    raise notice 'tailor_stream_app はありません（削除済み）';
    return;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'tailor_stream') then
    execute 'revoke all on schema tailor_stream from tailor_stream_app';
    execute 'revoke all on all tables in schema tailor_stream from tailor_stream_app';
    execute 'revoke all on all sequences in schema tailor_stream from tailor_stream_app';
    execute 'revoke all on all functions in schema tailor_stream from tailor_stream_app';
    execute 'alter default privileges in schema tailor_stream revoke all on tables from tailor_stream_app';
    execute 'alter default privileges in schema tailor_stream revoke all on sequences from tailor_stream_app';
  end if;

  begin
    execute 'drop role tailor_stream_app';
    raise notice 'tailor_stream_app を削除しました';
  exception when dependent_objects_still_exist then
    raise notice 'tailor_stream_app にはほかの DB の権限が残っています。その DB でもこのファイルを流してください';
  end;
end
$$;
