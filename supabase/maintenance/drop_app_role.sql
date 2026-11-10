-- 旧構成のアプリ用ロール tailor_stream_app を削除する（一度だけ流せばよい。何度流しても安全）
-- アプリはオーナーロールで接続するようになったので不要。init.sql の旧版を流した DB にだけ残っている。
-- drop owned で、このロールへの権限付与（デフォルト権限を含む）を外してから削除する。
-- ロールはクラスタ共通だが、drop owned は実行した DB の分しか外さないため、
-- 複数の DB に旧版を流した場合（ローカルの postgres と tailor_stream_test など）はそれぞれで流す。
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/maintenance/drop_app_role.sql

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'tailor_stream_app') then
    execute 'drop owned by tailor_stream_app';
    begin
      execute 'drop role tailor_stream_app';
    exception when dependent_objects_still_exist then
      raise notice 'tailor_stream_app にはほかの DB の権限が残っています。その DB でもこのファイルを流してください';
    end;
  end if;
end
$$;
