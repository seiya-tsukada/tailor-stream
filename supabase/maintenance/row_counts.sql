-- tailor_stream スキーマの全テーブルの件数（読み取りのみ）
--
--   psql "$ADMIN_DATABASE_URL" -f supabase/maintenance/row_counts.sql

select
  table_name,
  (xpath('/row/n/text()',
         query_to_xml(format('select count(*) as n from tailor_stream.%I', table_name), false, true, '')
  ))[1]::text::bigint as rows
from information_schema.tables
where table_schema = 'tailor_stream' and table_type = 'BASE TABLE'
order by table_name;
