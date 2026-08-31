-- 0061 — Dosje: Kosovo institutional and presidential deadlock.
-- The matcher remains in lib/topics.mjs; this seeds the database topic that
-- receives its reviewed article mappings and draft research moments.
-- Idempotent and intentionally leaves an already-approved status untouched.

insert into public.dosje_topics
  (slug, title, blurb, anchors, signals, excludes, status)
values
  (
    'bllokada-institucionale-kosove',
    'Bllokada institucionale e Kosovës',
    'Zgjedhjet e përsëritura, formimi i Kuvendit dhe bllokimi i zgjedhjes së presidentit.',
    array['president', 'kuvend', 'parlament', 'zgjedhje', 'bllokada'],
    array['mandat', 'koalicion', 'kuorum', 'votim', 'qeveri'],
    array[]::text[],
    'draft'
  )
on conflict (slug) do update
set title = excluded.title,
    blurb = excluded.blurb,
    anchors = excluded.anchors,
    signals = excluded.signals,
    excludes = excluded.excludes;
