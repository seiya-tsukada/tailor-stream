-- 期限切れデータの削除（init.sql の cleanup_expired_*() を呼ぶだけ。何度流しても安全）
-- - 保存: 期限切れの保存（ピン留めは期限が無いので残る）
-- - 記事: 掲載期限切れで、どの保存からも参照されていない記事と、空になったストーリー
-- - 認証: 期限切れ・失効済みのセッションと期限切れのログイントークン
-- 保存を先に消すことで、期限切れの保存だけが参照していた記事も同じ実行で消える。
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/maintenance/purge_expired.sql

select tailor_stream.cleanup_expired_saves()    as deleted_saves;
select tailor_stream.cleanup_expired_articles() as deleted_articles;
select tailor_stream.cleanup_expired_auth()     as deleted_auth_rows;
