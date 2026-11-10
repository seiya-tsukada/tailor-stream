-- =============================================================
-- TailorStream 初期スキーマ（docs/SPEC.md §4）
-- - Supabase は Postgres ホスティングとしてのみ使う（Supabase Auth / Data API / RLS は使わない）
-- - 全オブジェクトを tailor_stream スキーマに置く
-- - アプリ（Python バックエンド）は DB のオーナーロール（Supabase の postgres）で接続する。
--   search_path に頼らず、SQL ではテーブルを必ず tailor_stream.xxx と書く
-- - tailor_stream スキーマは Supabase の Exposed schemas に追加しないこと。
--   加えて anon / authenticated などの Data API 用ロールからは権限を外し、RLS をポリシー無しで有効にしておく
--   （オーナーは RLS の対象外なのでアプリには影響しない。Data API から見えてしまっても読めないようにする保険）
--
-- 冪等: すべての文は「無いときだけ作る」（IF NOT EXISTS / 存在チェック）か
-- 「同じ定義で置き換える」（CREATE OR REPLACE）ので、適用済みの DB に何度流しても変化しない。
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/init.sql
-- 既存テーブルの列や制約は変えないため、スキーマを変えるときは別ファイルを追加し、
-- そこでも add column if not exists などで冪等に書く（supabase db push は使わない）。
-- PostgreSQL 14 以上が必要（CREATE OR REPLACE TRIGGER）。
-- =============================================================

-- 2回目以降の適用で出る「already exists, skipping」の NOTICE を抑える（このセッションだけ）
set client_min_messages = warning;

create schema if not exists tailor_stream;

-- =============================================================
-- 共有データ（記事・カテゴリ）
-- =============================================================

-- カテゴリ（運営管理）
create table if not exists tailor_stream.categories (
  id          text primary key,              -- 'ai', 'web3' など slug
  name_ja     text not null,
  name_en     text not null,
  description text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

-- ストーリー（重複記事のまとまり）
create table if not exists tailor_stream.story_clusters (
  id                        text primary key,
  representative_article_id text,            -- articles.id（循環参照のため FK は articles 作成後に追加）
  source_count              int not null default 1 check (source_count >= 1),
  first_seen_at             timestamptz not null default now(),
  last_seen_at              timestamptz not null default now()
);

-- 記事（全ユーザー共有）
create table if not exists tailor_stream.articles (
  id                  text primary key,      -- 正規化 URL の SHA-256（先頭 32 文字）
  provider            text not null,         -- 'mock', 'google_alerts_rss' など
  provider_article_id text,
  canonical_url       text not null unique,
  title               text not null,
  snippet             text,                  -- プロバイダ提供の概要のみ。本文は保存しない
  source_name         text,
  source_domain       text not null,
  language            text not null,         -- 'ja', 'en' ...
  region              text,                  -- 'jp', 'global' ...
  image_url           text,
  published_at        timestamptz not null,
  share_count         int check (share_count is null or share_count >= 0),
  popularity_score    double precision not null default 0,
  cluster_id          text references tailor_stream.story_clusters (id) on delete set null,
  fetched_at          timestamptz not null default now(),
  expires_at          timestamptz not null   -- 一覧から外す時刻（例: 公開から 48h）
);
create index if not exists articles_cluster_id_idx   on tailor_stream.articles (cluster_id);
create index if not exists articles_published_at_idx on tailor_stream.articles (published_at desc);
create index if not exists articles_expires_at_idx   on tailor_stream.articles (expires_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'tailor_stream.story_clusters'::regclass
      and conname = 'story_clusters_representative_article_id_fkey'
  ) then
    alter table tailor_stream.story_clusters
      add constraint story_clusters_representative_article_id_fkey
      foreign key (representative_article_id) references tailor_stream.articles (id) on delete set null;
  end if;
end
$$;

-- 記事とカテゴリの対応（1記事が複数カテゴリに属しうる）
create table if not exists tailor_stream.article_categories (
  article_id  text references tailor_stream.articles (id) on delete cascade,
  category_id text references tailor_stream.categories (id),
  primary key (article_id, category_id)
);
create index if not exists article_categories_category_id_idx on tailor_stream.article_categories (category_id);

-- AI 生成結果の共有キャッシュ
create table if not exists tailor_stream.article_ai_cache (
  article_id text references tailor_stream.articles (id) on delete cascade,
  kind       text not null check (kind in ('summary', 'translation')),
  lang       text not null,
  content    text not null,
  model      text not null,
  created_at timestamptz not null default now(),
  primary key (article_id, kind, lang)
);

-- 取得ジョブの記録（API コスト監視・鮮度判定用）
create table if not exists tailor_stream.ingestion_runs (
  id            bigserial primary key,
  provider      text not null,
  category_id   text references tailor_stream.categories (id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null check (status in ('running', 'succeeded', 'failed')),
  fetched_count int,
  request_units int,
  error         text
);
create index if not exists ingestion_runs_category_started_idx on tailor_stream.ingestion_runs (category_id, started_at desc);

-- =============================================================
-- アカウント・認証（メールのマジックリンク方式。パスワードは持たない）
-- =============================================================

-- ユーザー（プランもここで持つ。plan の変更は決済 webhook の処理からのみ行う）
create table if not exists tailor_stream.users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null check (email = lower(email)),
  email_verified_at timestamptz,             -- マジックリンク成功時に設定
  display_name      text,
  plan              text not null default 'free' check (plan in ('free', 'pro')),
  plan_expires_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_login_at     timestamptz
);
create unique index if not exists users_email_key on tailor_stream.users (email);

-- ログイン用ワンタイムトークン（平文は保存せず SHA-256 のみ保存）
create table if not exists tailor_stream.login_tokens (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(email)),
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  request_ip  inet
);
create index if not exists login_tokens_email_created_idx on tailor_stream.login_tokens (email, created_at desc);
create index if not exists login_tokens_ip_created_idx    on tailor_stream.login_tokens (request_ip, created_at desc);

-- セッション（Cookie にはランダムトークン、DB には SHA-256 のみ保存）
create table if not exists tailor_stream.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references tailor_stream.users (id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  user_agent   text,
  ip_address   inet
);
create index if not exists sessions_user_id_idx    on tailor_stream.sessions (user_id);
create index if not exists sessions_expires_at_idx on tailor_stream.sessions (expires_at);

-- =============================================================
-- ユーザーデータ
-- =============================================================

-- 選択カテゴリ（最大3件。トリガーで強制）
create table if not exists tailor_stream.user_categories (
  user_id     uuid references tailor_stream.users (id) on delete cascade,
  category_id text references tailor_stream.categories (id),
  created_at  timestamptz not null default now(),
  primary key (user_id, category_id)
);

-- 保存・ピン留め
create table if not exists tailor_stream.user_saves (
  user_id    uuid references tailor_stream.users (id) on delete cascade,
  article_id text references tailor_stream.articles (id),
  saved_at   timestamptz not null default now(),
  expires_at timestamptz,                    -- ピン留めは null（トリガーで設定）
  is_pinned  boolean not null default false,
  primary key (user_id, article_id),
  check ((is_pinned and expires_at is null) or (not is_pinned and expires_at is not null))
);
create index if not exists user_saves_article_id_idx on tailor_stream.user_saves (article_id);
create index if not exists user_saves_expires_at_idx on tailor_stream.user_saves (expires_at) where expires_at is not null;

-- =============================================================
-- トリガー（アプリのバグがあっても DB 側で不正を止める）
-- =============================================================

-- 選択カテゴリは1ユーザー最大3件
create or replace function tailor_stream.enforce_user_categories_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_categories constant int := 3;
  current_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended('tailor_stream.user_categories:' || new.user_id::text, 0));

  select count(*) into current_count
  from tailor_stream.user_categories
  where user_id = new.user_id
    and not (tg_op = 'UPDATE' and user_id = old.user_id and category_id = old.category_id);

  if current_count >= max_categories then
    raise exception 'user_categories limit exceeded (max %)', max_categories
      using errcode = 'check_violation', hint = 'category_limit_exceeded';
  end if;
  return new;
end;
$$;

create or replace trigger enforce_user_categories_limit
  before insert or update of user_id on tailor_stream.user_categories
  for each row execute function tailor_stream.enforce_user_categories_limit();

-- 保存の期限設定とピン留め権限チェック
-- - 期限はサーバー時刻基準: expires_at = saved_at + 6h を常に上書きする
-- - 新たにピン留めするときだけ Pro かつ期限内を要求する（既存のピン留めは解約後も残す。SPEC §6）
create or replace function tailor_stream.prepare_user_save()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  save_ttl constant interval := interval '6 hours';
  is_pro boolean;
begin
  new.saved_at := least(coalesce(new.saved_at, now()), now());

  if new.is_pinned then
    if tg_op = 'INSERT' or not old.is_pinned then
      select exists (
        select 1
        from tailor_stream.users u
        where u.id = new.user_id
          and u.plan = 'pro'
          and (u.plan_expires_at is null or u.plan_expires_at > now())
      ) into is_pro;

      if not is_pro then
        raise exception 'pinning requires an active pro plan'
          using errcode = 'insufficient_privilege', hint = 'pro_required';
      end if;
    end if;
    new.expires_at := null;
  else
    new.expires_at := new.saved_at + save_ttl;
  end if;

  return new;
end;
$$;

create or replace trigger prepare_user_save
  before insert or update on tailor_stream.user_saves
  for each row execute function tailor_stream.prepare_user_save();

-- =============================================================
-- 期限切れデータの削除（呼び出し元は後で決める: 管理 API / pg_cron など）
-- =============================================================

create or replace function tailor_stream.cleanup_expired_saves()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from tailor_stream.user_saves
  where expires_at is not null and expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- 掲載期限切れで、どの保存からも参照されていない記事を削除。空になったストーリーも削除
create or replace function tailor_stream.cleanup_expired_articles()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from tailor_stream.articles a
  where a.expires_at < now()
    and not exists (select 1 from tailor_stream.user_saves s where s.article_id = a.id);
  get diagnostics deleted_count = row_count;

  delete from tailor_stream.story_clusters c
  where not exists (select 1 from tailor_stream.articles a where a.cluster_id = c.id);

  return deleted_count;
end;
$$;

-- 期限切れ・失効済みのセッションと使用済み/期限切れのログイントークンを削除
create or replace function tailor_stream.cleanup_expired_auth()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  deleted_sessions integer;
  deleted_tokens integer;
begin
  delete from tailor_stream.sessions
  where expires_at < now() or revoked_at < now() - interval '1 day';
  get diagnostics deleted_sessions = row_count;

  delete from tailor_stream.login_tokens
  where expires_at < now() - interval '1 day';
  get diagnostics deleted_tokens = row_count;

  return deleted_sessions + deleted_tokens;
end;
$$;

-- =============================================================
-- 権限（アプリはオーナーロールで接続するので付与は不要。それ以外のロールからは外す）
-- =============================================================

revoke all on schema tailor_stream from public;
revoke all on all tables in schema tailor_stream from public;
revoke all on all sequences in schema tailor_stream from public;
revoke execute on all functions in schema tailor_stream from public;
alter default privileges in schema tailor_stream revoke execute on functions from public;

-- Supabase の Data API 用ロール（ローカルの Postgres には無いので、あるときだけ外す）
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema tailor_stream from %I', r);
      execute format('revoke all on all tables in schema tailor_stream from %I', r);
      execute format('revoke all on all sequences in schema tailor_stream from %I', r);
      execute format('revoke all on all functions in schema tailor_stream from %I', r);
    end if;
  end loop;
end
$$;

-- RLS をポリシー無しで有効にする（オーナー以外は1行も読み書きできない。何度実行しても同じ）
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'tailor_stream'
  loop
    execute format('alter table tailor_stream.%I enable row level security', t);
  end loop;
end
$$;
