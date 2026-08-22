-- Articles must outlive the batch record that happened to publish them.
--
-- Context, 2026-08-22: public.news_articles read back empty and the site fell
-- through to sample copy. public.news_batches was empty at the same moment.
--
-- 0003 declared the link as:
--
--   batch_key text not null references public.news_batches(batch_key)
--     on delete cascade
--
-- so removing one batch row deletes every article filed under it, with no
-- second confirmation and nothing in the application layer able to object. A
-- routine tidy-up of batch bookkeeping — by hand, or by any job holding the
-- service-role key — takes the newsroom's published work with it.
--
-- That is the wrong default. A batch is bookkeeping about how a group of
-- articles arrived; the articles are the product. Deleting the receipt should
-- not delete the goods.
--
-- This does not prove the cascade caused the incident, and it does not restore
-- anything. It removes the path by which a single delete can empty the site.
--
-- After this runs, batch_key is nullable and clearing a batch orphans its
-- articles instead of destroying them. Idempotent: safe to re-run.

do $$
declare
  v_constraint text;
begin
  -- The constraint name is whatever Postgres generated, so find it rather than
  -- guessing at news_articles_batch_key_fkey.
  select con.conname into v_constraint
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'news_articles'
     and con.contype = 'f'
     and pg_get_constraintdef(con.oid) ilike '%news_batches%';

  if v_constraint is not null then
    execute format('alter table public.news_articles drop constraint %I', v_constraint);
    raise notice 'dropped foreign key %', v_constraint;
  else
    raise notice 'no batch foreign key found; nothing to drop';
  end if;
end $$;

-- An orphaned article keeps every other column intact, so it still renders.
alter table public.news_articles
  alter column batch_key drop not null;

alter table public.news_articles
  add constraint news_articles_batch_key_fkey
  foreign key (batch_key)
  references public.news_batches(batch_key)
  on delete set null;

comment on column public.news_articles.batch_key is
  'The publishing run this article arrived in. Nullable on purpose: deleting a batch orphans its articles rather than deleting them (see migration 0047).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
--
-- Expect one row, and its definition should end in ON DELETE SET NULL.
-- ─────────────────────────────────────────────────────────────────────────────
select con.conname, pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
 where nsp.nspname = 'public'
   and rel.relname = 'news_articles'
   and con.contype = 'f'
   and pg_get_constraintdef(con.oid) ilike '%news_batches%';
