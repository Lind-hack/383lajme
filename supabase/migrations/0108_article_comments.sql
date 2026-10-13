-- Readers' comments under any story on 383 (lib/article-comments.mjs,
-- app/api/comments, components/comments).
--
-- Signed-in readers only. A comment shows at once; three reports from
-- different readers hide it until an editor looks (app/admin/komente). One
-- level of replies. The name is the reader's public name when they posted
-- (profiles are owner-only since 0065, so it is kept on the comment).
--
-- Only the server touches these tables (service role, after checking the
-- reader's session): RLS is on with no policies.
--
-- Idempotent: safe to re-run.

create table if not exists public.article_comments (
  id            bigint generated always as identity primary key,
  article_slug  text        not null,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  author_name   text        not null,
  body          text        not null,
  parent_id     bigint      references public.article_comments (id) on delete cascade,
  status        text        not null default 'visible',
  report_count  integer     not null default 0,
  -- An editor looked and kept it: reports no longer hide it.
  kept          boolean     not null default false,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'article_comments_slug_check') then
    alter table public.article_comments
      add constraint article_comments_slug_check check (article_slug ~ '^[a-z0-9-]{1,160}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'article_comments_body_check') then
    alter table public.article_comments
      add constraint article_comments_body_check check (char_length(body) between 1 and 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'article_comments_name_check') then
    alter table public.article_comments
      add constraint article_comments_name_check check (char_length(author_name) between 1 and 48);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'article_comments_status_check') then
    alter table public.article_comments
      add constraint article_comments_status_check check (status in ('visible', 'hidden', 'deleted'));
  end if;
end $$;

create index if not exists article_comments_thread_idx
  on public.article_comments (article_slug, created_at desc) where status = 'visible';
create index if not exists article_comments_user_idx
  on public.article_comments (user_id, created_at desc);
create index if not exists article_comments_review_idx
  on public.article_comments (report_count desc, created_at desc) where report_count > 0;

alter table public.article_comments enable row level security;

create table if not exists public.article_comment_reports (
  comment_id  bigint      not null references public.article_comments (id) on delete cascade,
  reporter_id uuid        not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, reporter_id)
);

alter table public.article_comment_reports enable row level security;

-- Visible comments per story, for the count on every comment button.
create or replace function public.article_comment_counts(slugs text[])
returns table (article_slug text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.article_slug, count(*)::bigint
  from public.article_comments c
  where c.article_slug = any(slugs) and c.status = 'visible'
  group by c.article_slug
$$;

-- One report per reader per comment; at `hide_at` reports the comment is
-- hidden until an editor looks (unless an editor already kept it). Returns the comment's status afterwards.
create or replace function public.report_article_comment(p_comment bigint, p_reporter uuid, hide_at integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  reports integer;
  result  text;
begin
  insert into public.article_comment_reports (comment_id, reporter_id)
  values (p_comment, p_reporter)
  on conflict do nothing;

  select count(*) into reports from public.article_comment_reports where comment_id = p_comment;

  update public.article_comments
     set report_count = reports,
         status = case when status = 'visible' and not kept and reports >= hide_at then 'hidden' else status end
   where id = p_comment
  returning status into result;

  return result;
end
$$;

revoke all on function public.article_comment_counts(text[]) from public, anon, authenticated;
revoke all on function public.report_article_comment(bigint, uuid, integer) from public, anon, authenticated;
