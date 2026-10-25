-- TailorStream 初期スキーマ（docs/SPEC.md §4）
-- 契約前のため未適用。`supabase db push` でそのまま適用できる形で書いている。

-- =============================================================
-- テーブル
-- =============================================================

-- カテゴリ（運営管理）
create table public.categories (
  id          text primary key,              -- 'ai', 'web3' など slug
  name_ja     text not null,
  name_en     text not null,
  description text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

-- ストーリー（重複記事のまとまり）
create table public.story_clusters (
  id                        text primary key,
  representative_article_id text,            -- articles.id（循環参照のため FK は articles 作成後に追加）
  source_count              int not null default 1 check (source_count >= 1),  -- 報じた媒体数
  first_seen_at             timestamptz not null default now(),
  last_seen_at              timestamptz not null default now()
);

-- 記事（全ユーザー共有）
create table public.articles (
  id                  text primary key,      -- 正規化 URL の SHA-256（先頭 32 文字）
  provider            text not null,         -- 'mock' など
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
  share_count         int check (share_count is null or share_count >= 0),  -- 取得できない場合は null
  popularity_score    double precision not null default 0,
  cluster_id          text references public.story_clusters (id) on delete set null,
  fetched_at          timestamptz not null default now(),
  expires_at          timestamptz not null   -- 一覧から外す時刻（例: 公開から 48h）
);
create index articles_cluster_id_idx on public.articles (cluster_id);
create index articles_published_at_idx on public.articles (published_at desc);
create index articles_expires_at_idx on public.articles (expires_at);

alter table public.story_clusters
  add constraint story_clusters_representative_article_id_fkey
  foreign key (representative_article_id) references public.articles (id) on delete set null;

-- 記事とカテゴリの対応（1記事が複数カテゴリに属しうる）
create table public.article_categories (
  article_id  text references public.articles (id) on delete cascade,
  category_id text references public.categories (id),
  primary key (article_id, category_id)
);
create index article_categories_category_id_idx on public.article_categories (category_id);

-- ユーザープロフィール（auth.users と 1:1）
create table public.profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  plan            text not null default 'free' check (plan in ('free', 'pro')),
  plan_expires_at timestamptz,
  created_at      timestamptz not null default now()
);

-- ユーザーの選択カテゴリ（最大3件。トリガーで強制）
create table public.user_categories (
  user_id     uuid references auth.users (id) on delete cascade,
  category_id text references public.categories (id),
  created_at  timestamptz not null default now(),
  primary key (user_id, category_id)
);

-- 保存・ピン留め
create table public.user_saves (
  user_id    uuid references auth.users (id) on delete cascade,
  article_id text references public.articles (id),
  saved_at   timestamptz not null default now(),
  expires_at timestamptz,                    -- ピン留めは null（トリガーで設定）
  is_pinned  boolean not null default false,
  primary key (user_id, article_id),
  check ((is_pinned and expires_at is null) or (not is_pinned and expires_at is not null))
);
create index user_saves_article_id_idx on public.user_saves (article_id);
create index user_saves_expires_at_idx on public.user_saves (expires_at) where expires_at is not null;

-- AI 生成結果の共有キャッシュ
create table public.article_ai_cache (
  article_id text references public.articles (id) on delete cascade,
  kind       text not null check (kind in ('summary', 'translation')),
  lang       text not null,                  -- 出力言語
  content    text not null,
  model      text not null,
  created_at timestamptz not null default now(),
  primary key (article_id, kind, lang)
);

-- 取得ジョブの記録（API コスト監視用）
create table public.ingestion_runs (
  id            bigserial primary key,
  provider      text not null,
  category_id   text references public.categories (id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null check (status in ('running', 'succeeded', 'failed')),
  fetched_count int,
  request_units int,                         -- API の消費単位（トークン・リクエスト数）
  error         text
);
create index ingestion_runs_started_at_idx on public.ingestion_runs (started_at desc);

-- =============================================================
-- トリガー
-- =============================================================

-- auth.users 作成時に free プランのプロフィールを作る
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 選択カテゴリは1ユーザー最大3件
create function public.enforce_user_categories_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_categories constant int := 3;
  current_count int;
begin
  -- 同一ユーザーの同時 insert で上限を超えないよう、ユーザー単位で直列化する
  perform pg_advisory_xact_lock(hashtextextended('user_categories:' || new.user_id::text, 0));

  select count(*) into current_count
  from public.user_categories
  where user_id = new.user_id
    and not (tg_op = 'UPDATE' and user_id = old.user_id and category_id = old.category_id);

  if current_count >= max_categories then
    raise exception 'user_categories limit exceeded (max %)', max_categories
      using errcode = 'check_violation', hint = 'category_limit_exceeded';
  end if;
  return new;
end;
$$;

create trigger enforce_user_categories_limit
  before insert or update of user_id on public.user_categories
  for each row execute function public.enforce_user_categories_limit();

-- 保存の期限設定とピン留め権限チェック
-- - 期限はサーバー時刻基準: saved_at は未来にできず、expires_at = saved_at + 6h を常に上書きする
--   （匿名からの移行で元の saved_at を渡すと、残り時間を引き継げる）
-- - ピン留めは expires_at = null
-- - 新たにピン留めする（insert で pin / unpin → pin）ときだけ Pro かつ期限内を要求する。
--   既にピン留め済みの行は Pro 解約後もそのまま残す（SPEC §6）
create function public.prepare_user_save()
returns trigger
language plpgsql
security definer
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
        from public.profiles p
        where p.user_id = new.user_id
          and p.plan = 'pro'
          and (p.plan_expires_at is null or p.plan_expires_at > now())
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

create trigger prepare_user_save
  before insert or update on public.user_saves
  for each row execute function public.prepare_user_save();

-- =============================================================
-- RLS
-- =============================================================

alter table public.categories enable row level security;
alter table public.story_clusters enable row level security;
alter table public.articles enable row level security;
alter table public.article_categories enable row level security;
alter table public.article_ai_cache enable row level security;
alter table public.profiles enable row level security;
alter table public.user_categories enable row level security;
alter table public.user_saves enable row level security;
-- ingestion_runs は運用データのためポリシーなし（service role のみアクセス可）
alter table public.ingestion_runs enable row level security;

-- 共有データ: 全員 select 可。書き込みポリシーは作らない（service role は RLS をバイパスする）
create policy "categories are readable by everyone"
  on public.categories for select to anon, authenticated using (true);
create policy "story_clusters are readable by everyone"
  on public.story_clusters for select to anon, authenticated using (true);
create policy "articles are readable by everyone"
  on public.articles for select to anon, authenticated using (true);
create policy "article_categories are readable by everyone"
  on public.article_categories for select to anon, authenticated using (true);
create policy "article_ai_cache is readable by everyone"
  on public.article_ai_cache for select to anon, authenticated using (true);

-- profiles: 本人の行のみ。plan / plan_expires_at を変えられないよう update・delete は許可しない
-- （作成は handle_new_user トリガー、plan の更新は決済 webhook = service role が行う）
create policy "users can read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
-- トリガーが動かなかった場合の保険として、free のプロフィールだけは本人が作成できる
create policy "users can create own free profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and plan = 'free' and plan_expires_at is null);
-- ポリシーに加えて列権限でも塞ぐ（ユーザーが編集できる列を足すときは grant update (列名) で個別に許可する）
revoke update, delete on public.profiles from anon, authenticated;

-- user_categories / user_saves: 本人の行のみ select / insert / update / delete 可
create policy "users can read own categories"
  on public.user_categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can insert own categories"
  on public.user_categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update own categories"
  on public.user_categories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete own categories"
  on public.user_categories for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can read own saves"
  on public.user_saves for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can insert own saves"
  on public.user_saves for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update own saves"
  on public.user_saves for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete own saves"
  on public.user_saves for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =============================================================
-- 期限切れデータの削除（SPEC §4「削除ジョブ」）
-- =============================================================

-- 期限切れの保存を削除し、削除件数を返す（ピン留めは expires_at が null なので対象外）
create function public.cleanup_expired_saves()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.user_saves
  where expires_at is not null and expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- 掲載期限を過ぎ、どの保存・ピン留めからも参照されていない記事を削除し、削除件数を返す。
-- 記事がなくなったストーリーも合わせて削除する。
create function public.cleanup_expired_articles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.articles a
  where a.expires_at < now()
    and not exists (select 1 from public.user_saves s where s.article_id = a.id);
  get diagnostics deleted_count = row_count;

  delete from public.story_clusters c
  where not exists (select 1 from public.articles a where a.cluster_id = c.id);

  return deleted_count;
end;
$$;

revoke execute on function public.cleanup_expired_saves() from public, anon, authenticated;
revoke execute on function public.cleanup_expired_articles() from public, anon, authenticated;

-- pg_cron での定期実行例（Supabase で pg_cron を有効化してから実行する。保存→記事の順で消す）
-- select cron.schedule('cleanup-expired-saves', '*/10 * * * *', $$select public.cleanup_expired_saves()$$);
-- select cron.schedule('cleanup-expired-articles', '15 * * * *', $$select public.cleanup_expired_articles()$$);
