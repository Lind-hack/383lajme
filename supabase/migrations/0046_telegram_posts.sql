-- 0046 — Telegram dispatch ledger.
--
-- The dispatcher (app/api/cron/dispatch-telegram) records every message it
-- sends here so a re-run, a second scheduler, or a retry can never resend the
-- same story. article_slug is unique across channels for now — one channel
-- ships at a time; relax to (channel, article_slug) when a second one exists.
--
-- RLS is enabled with no policies: anon and authenticated roles see nothing.
-- Only the service-role key (createAdminClient) reads and writes.

create table if not exists telegram_posts (
  id bigint generated always as identity primary key,
  article_slug text not null unique,
  channel text not null,
  message_id bigint,
  posted_at timestamptz not null default now()
);

create index if not exists telegram_posts_recent on telegram_posts (posted_at);

alter table telegram_posts enable row level security;
