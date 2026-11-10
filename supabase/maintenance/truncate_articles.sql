-- 記事まわりの共有データを全削除する（取り込み直したいとき用）
-- 対象: articles / story_clusters / article_categories / article_ai_cache / ingestion_runs と、記事を参照する user_saves
-- 残す: categories / users / sessions / login_tokens / user_categories
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=yes -f supabase/maintenance/truncate_articles.sql
--
-- -v confirm=yes が無いと何もせずに止まる。

\if :{?confirm}
\else
  \echo 'truncate_articles.sql: 記事・ストーリー・AI キャッシュ・取り込み記録・全ユーザーの保存を削除します。-v confirm=yes を付けて再実行してください'
  do $$ begin raise exception 'confirmation required (-v confirm=yes)'; end $$;
\endif

begin;

truncate table
  tailor_stream.user_saves,
  tailor_stream.article_ai_cache,
  tailor_stream.article_categories,
  tailor_stream.articles,
  tailor_stream.story_clusters,
  tailor_stream.ingestion_runs
restart identity;

commit;
