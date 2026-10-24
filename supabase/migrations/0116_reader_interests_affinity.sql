-- Për ty: what reading taught the paper, kept with the signed-in reader's
-- account so their phone and laptop learn together.
--
-- The device copy stays the one the page reads (lib/interests.mjs). Once a
-- browser session, lib/interests-sync.ts merges the two (per key, the stronger
-- decayed weight wins, so merging again changes nothing) and writes the result
-- to both. Guests have no row and keep it on the device only. The shape is
-- the device's: { "<cat|person|city>:<id>": { w, t, s?, n? } }, at most 50
-- keys, normalised by the client on every read.

alter table public.reader_interests
  add column if not exists affinity jsonb not null default '{}'::jsonb;

comment on column public.reader_interests.affinity is
  'Learned reading affinity for Për ty (same shape as the device copy). Owner-only by the table''s RLS; never shown to anyone else.';
