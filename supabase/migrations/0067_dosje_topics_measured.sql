-- Standing subjects chosen from what 383 published, not from what it ought to.
--
-- 0064 added twelve subjects on the reasoning that the six existing topics all
-- sat on one beat while forty percent of output was sport. The reasoning was
-- right and the subjects were wrong. Measured over the whole archive on disk --
-- 1,228 articles, 2026-03-30 to 2026-08-29, five months -- the twelve returned
-- nineteen matches between them, and six returned none at all:
--
--     irani-dhe-shba               7      superliga-e-kosoves          0
--     konfliktet-e-izraelit        4      atletet-olimpike-te-kosoves  0
--     cmimet-dhe-inflacioni        3      energjia-dhe-kek             0
--     presidenca-e-trumpit         2      dua-lipa                     0
--     gjykata-speciale             2      rita-ora                     0
--     kombetarja-e-kosoves         1      bebe-rexha                   0
--
-- The miss is the same in every case: the subject is Kosovar and the coverage
-- is not. 383's sport is Barcelona, the Premier League, the World Cup and
-- Messi, not the Superliga; its showbiz is Taylor Swift, not the Albanian
-- diaspora singers; its technology -- 117 articles, the third largest category
-- -- had no dossier at all.
--
-- The six subjects below were written against the measured vocabulary of those
-- 1,228 titles and scored before being proposed. Added to the eighteen they
-- take dossier coverage from 139 articles to 279, 11.3% to 22.7%:
--
--     inteligjenca-artificiale    54    (3 of 5 months)
--     kupa-boterore-2026          22    (2 of 5 months)
--     lionel-messi                19    (2 of 5 months)
--     merkato-e-transfereve       19    (3 of 5 months)
--     taylor-swift                19    (2 of 5 months)
--     zgjedhjet-ne-kosove          9    (1 of 5 months)
--
-- Every one ships as 'draft', the convention 0064 set: a draft topic takes part
-- in matching from today and so starts accumulating dosje_article_topics, while
-- the public read policy keeps an empty dossier off the site. Approve one when
-- it has milestones worth showing.
--
-- Anchors are folded, without diacritics, because the matcher folds the
-- haystack first. They are phrases wherever a single word would be ambiguous: a
-- database topic carries no matchGroups, so scoreTopic reads every anchor as a
-- group of one and any single anchor can carry a match by itself.

insert into public.dosje_topics (slug, title, blurb, status, anchors, signals, excludes) values

-- ── Teknologji ───────────────────────────────────────────────────────────────
-- The largest gap in the set. "openai" and "anthropic" are unambiguous as bare
-- words; "model" is not, and stays a signal.
('inteligjenca-artificiale',
 'Inteligjenca artificiale',
 'Modelet e reja, kompanitë që i ndërtojnë dhe rregullat që i ndjekin.',
 'draft',
 array['inteligjenca artificiale','openai','anthropic','chatgpt','modeli i ri i inteligjences'],
 array['model','modelet','chatbot','gemini','claude','nvidia','algoritem','rregullore','investim','padi'],
 array[]::text[]),

-- ── Sport ────────────────────────────────────────────────────────────────────
-- Kept apart from kombetarja-e-kosoves, which owns Kosovo's own campaign. This
-- one is the tournament everywhere else, and the two never bid for an article
-- because the anchors name different things.
('kupa-boterore-2026',
 'Kupa Botërore 2026',
 'Kualifikueset, tërheqja e grupeve dhe rruga drejt Botërorit 2026.',
 'draft',
 array['kupa e botes','kupen e botes','boterori 2026','kualifikueset per boteror','fifa world cup','eliminatoret e boterorit'],
 array['fifa','grupi','ndeshje','kualifikuese','eliminim direkt','faza','perzgjedhesi','stadiumi'],
 array['kupa e mbretit','boterori i klubeve']),

('merkato-e-transfereve',
 'Merkato e transfereve',
 'Transferimet e mëdha në futbollin evropian dhe afatet e merkatos.',
 'draft',
 array['merkato e transfereve','fabrizio romano','afati i transfereve','here we go'],
 array['transferim','kontrate','klauzole','premier league','real madrid','barcelona','juventus','milione euro'],
 array[]::text[]),

('lionel-messi',
 'Lionel Messi',
 'Kariera e Lionel Messit te Interi i Majamit dhe kombëtarja argjentinase.',
 'draft',
 array['lionel messi','lionel messit','inter miami'],
 array['argjentina','gol','asistim','kontrate','kapiten'],
 array[]::text[]),

-- ── Showbiz ──────────────────────────────────────────────────────────────────
-- Replaces three subjects with none. The name carries a match on its own; so
-- does Kelce's, and the archive treats the two as one story.
('taylor-swift',
 'Taylor Swift',
 'Albumet, turneu dhe jeta publike e Taylor Swift.',
 'draft',
 array['taylor swift','travis kelce'],
 array['album','turne','koncert','dasme','fejesa','kenge','eras'],
 array[]::text[]),

-- ── Kosovë ───────────────────────────────────────────────────────────────────
-- Excludes every other country's ballot, which is what the near misses were.
('zgjedhjet-ne-kosove',
 'Zgjedhjet në Kosovë',
 'Fushatat, numërimi, certifikimi dhe formimi i qeverisë pas zgjedhjeve.',
 'draft',
 array['zgjedhjet ne kosove','komisioni qendror i zgjedhjeve','zgjedhjet e parakohshme ne kosove','fushata zgjedhore ne kosove'],
 array['kqz','votat','numerimi','certifikimi','mandati','koalicion','vetevendosje'],
 array['zgjedhjet ne serbi','zgjedhjet ne shqiperi','zgjedhjet amerikane'])

on conflict (slug) do nothing;

-- The six that never matched anything are retired rather than deleted.
--
-- Retired is the correct state and deletion is not: the subjects scan reads
-- every topic that is not retired, so retiring stops them competing for an
-- article without discarding the anchors, which were not wrong -- the articles
-- were absent. If 383 starts covering the Superliga, one update brings the
-- topic back exactly as it was written.
--
-- Guarded on having no milestones, so this can never retire a subject an editor
-- has since done work on.
update public.dosje_topics t
   set status = 'retired'
 where t.slug in (
         'superliga-e-kosoves',
         'atletet-olimpike-te-kosoves',
         'energjia-dhe-kek',
         'dua-lipa',
         'rita-ora',
         'bebe-rexha'
       )
   and t.status = 'draft'
   and not exists (
         select 1 from public.dosje_milestones m where m.topic_slug = t.slug
       );
