-- Kosova në xhep showcase: approved visitor trips on the public page.
-- The originals stay in the private xhep-submissions bucket. When an admin
-- approves a trip, the server writes re-encoded copies (resized, metadata
-- such as GPS stripped) to the public xhep-public bucket and records their
-- paths here; rejecting removes them. Only rows with status 'approved' are
-- ever read for the page, and only by the server (RLS stays on, no policies).

alter table public.xhep_submissions
  add column if not exists public_photo_paths text[] not null default '{}'
    check (cardinality(public_photo_paths) <= 8);

create index if not exists xhep_submissions_showcase_idx
  on public.xhep_submissions (placement, reviewed_at desc)
  where status = 'approved';

insert into storage.buckets (id, name, public)
values ('xhep-public', 'xhep-public', true)
on conflict (id) do update set public = true;
