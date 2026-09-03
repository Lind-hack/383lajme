-- Twelve subjects the newsroom actually publishes.
--
-- Measured on the live archive: of 103 recent articles exactly one matched any
-- existing dossier. That single match was correct -- the six near misses the
-- matcher refused were Serbia's own elections, Montenegro's EU path, North
-- Macedonia, Albania and Libya -- but it means the six standing topics all sit
-- on one beat, Kosovo-Serbia diplomacy, while forty percent of what 383
-- publishes is sport. A subject cannot become a file if the newsroom writes
-- about it once a week.
--
-- Three requested subjects are deliberately absent because an existing topic
-- already claims their vocabulary, and splitting scarce matches across two
-- competing topics would push both below the standing bar rather than either
-- above it:
--   visa liberalisation  -> anetaresimi-ne-be already claims "viza"
--   north Kosovo         -> kfor already claims "mitrovica" and "zvecan"
--   remittances          -> diaspora already claims "remitanca"
--
-- Anchors are stored folded, without diacritics, because the matcher folds the
-- haystack before comparing. They are also stored as phrases wherever a single
-- word would be ambiguous: a database topic carries no matchGroups, so
-- scoreTopic turns every anchor into a group of one and any single anchor can
-- carry a match on its own. "kek" alone would match the Albanian word for cake.
--
-- Every topic below ships as 'draft', not 'approved', and that is deliberate.
-- Measured across the whole archive at the time of writing -- 103 articles --
-- these subjects return: Dua Lipa 0, Rita Ora 0, Bebe Rexha 0, kombetarja 0,
-- Superliga 0, KEK 0, inflacion 0, Gjykata Speciale 0, Trump 0. Only Iran (6)
-- and Izrael (1) appear at all. The sport coverage is Barcelona, Arsenal, PSG,
-- the US Open and Formula 1; the showbiz coverage is Ryan Reynolds and Dolly
-- Parton. The anchors are not wrong, the articles are absent.
--
-- A draft topic still participates in matching -- the subjects scan reads every
-- topic that is not retired -- so these accumulate mappings from the day the
-- newsroom starts covering the subject, while the public read policy keeps an
-- empty dossier off the site. Approve one when it has milestones worth showing.
insert into public.dosje_topics (slug, title, blurb, status, anchors, signals, excludes) values

-- ── Sport ────────────────────────────────────────────────────────────────────
('kombetarja-e-kosoves',
 'Kombëtarja e Kosovës',
 'Fushata kualifikuese e Kosovës për Botëror dhe Evropian, ndeshjet dhe përzgjedhësit.',
 'draft',
 array['kombetarja e kosoves','kombetarja e kosove','dardanet','kualifikueset e kosoves'],
 array['kualifikuese','boterori','evropiani','ndeshje','perzgjedhesi','grupi','fifa','uefa'],
 array['kombetarja e shqiperise','kuqezinjte']),

('superliga-e-kosoves',
 'Superliga e Kosovës',
 'Kampionati vendas: gara për titullin, klubet dhe Evropa.',
 'draft',
 array['superliga e kosoves','superliga e kosove','ipko superliga'],
 array['prishtina','drita','ballkani','llapi','feronikeli','malisheva','titulli','kampion'],
 array['superliga e shqiperise','superliga turke','serie a','la liga']),

('atletet-olimpike-te-kosoves',
 'Atletët olimpikë të Kosovës',
 'Xhudistët dhe atletët e Kosovës në Lojërat Olimpike dhe kampionatet botërore.',
 'draft',
 array['majlinda kelmendi','distria krasniqi','nora gjakova','akil gjakova','loriana kuka','lojerat olimpike'],
 array['xhudo','medalje','ari','olimpike','kampionati boteror','ippon'],
 array['futboll','superliga']),

-- ── Ekonomi ──────────────────────────────────────────────────────────────────
('energjia-dhe-kek',
 'Energjia dhe KEK',
 'Prodhimi i rrymës, termocentralet e Obiliqit, importi dhe kriza energjetike.',
 'draft',
 array['korporata energjetike e kosoves','termocentrali kosova','kosova b','kek-u','kriza energjetike'],
 array['obiliq','rryma','energji','import','tarifat','zrre','shkurtime','linjit'],
 array['kek me cokollate']),

('cmimet-dhe-inflacioni',
 'Çmimet dhe inflacioni',
 'Rritja e çmimeve, shporta e konsumit dhe fuqia blerëse në Kosovë.',
 'draft',
 array['inflacioni ne kosove','rritja e cmimeve','shporta e konsumit','shporta baze'],
 array['inflacion','cmimet','ask','banka qendrore','fuqia blerese','paga minimale'],
 array['bursa','kriptovaluta']),

-- ── Kosovë ───────────────────────────────────────────────────────────────────
('gjykata-speciale',
 'Gjykata Speciale',
 'Dhomat e Specializuara në Hagë: aktakuzat, gjykimet dhe të pandehurit nga Kosova.',
 'draft',
 array['gjykata speciale','dhomat e specializuara','specialja ne hage','zyra e prokurorit te specializuar'],
 array['hage','aktakuze','aktakuza','gjykimi','paraburgim','thaci','veseli','selimi','krasniqi','ukshin'],
 array['gjykata kushtetuese','gjykata themelore','gjykata e apelit']),

-- ── Botë ─────────────────────────────────────────────────────────────────────
-- Kept apart from trump-dhe-ballkani, which owns anything Trump says about the
-- region. This one is his presidency everywhere else, and excludes the Balkans
-- so the two can never bid for the same article.
('presidenca-e-trumpit',
 'Presidenca e Trumpit',
 'Vendimet, dekretet dhe politikat e administratës Trump.',
 'draft',
 array['administrata trump','shtepia e bardhe','presidenti amerikan donald trump'],
 array['dekret','tarifa','tarifat','republikan','kongresi','senati','uashington','vendim'],
 array['ballkan','ballkani','kosove','kosova','serbi','serbia','shqiperi']),

('irani-dhe-shba',
 'Irani dhe SHBA',
 'Përballja mes Iranit dhe Shteteve të Bashkuara: programi bërthamor, sanksionet dhe sulmet.',
 'draft',
 array['programi berthamor iranian','irani dhe shba','teherani','republika islamike e iranit'],
 array['iran','irani','sanksione','berthamor','uranium','ndeshje','sulm','raketa','hormuz'],
 array['irlande','irlanda']),

('konfliktet-e-izraelit',
 'Konfliktet e Izraelit',
 'Lufta në Gaza dhe përballjet e Izraelit me Libanin, Iranin dhe fqinjët.',
 'draft',
 array['izraeli dhe gaza','hamasi','hezbollahu','netanyahu','rripi i gazes'],
 array['izrael','gaza','liban','libani','hamas','hezbollah','armepushim','sulm ajror','pengje'],
 array['kosove','kosova']),

-- ── Showbiz ──────────────────────────────────────────────────────────────────
-- Names are unambiguous on their own, which is what a database topic needs:
-- every anchor becomes a group of one.
('dua-lipa',
 'Dua Lipa',
 'Karriera e Dua Lipës: albumet, turnetë, çmimet dhe lidhja e saj me Kosovën.',
 'draft',
 array['dua lipa','dua lipes','dua lipen'],
 array['album','turne','koncert','kenge','sunny hill','grammy','brit awards','single','klip'],
 array[]::text[]),

('rita-ora',
 'Rita Ora',
 'Muzika, televizioni dhe paraqitjet publike të Rita Orës.',
 'draft',
 array['rita ora','rita ores','rita oren'],
 array['album','turne','koncert','kenge','the voice','grammy','single','klip','film'],
 array[]::text[]),

('bebe-rexha',
 'Bebe Rexha',
 'Karriera muzikore e Bebe Rexhës, bashkëpunimet dhe qëndrimet e saj publike.',
 'draft',
 array['bebe rexha','bebe rexhes','bebe rexhen'],
 array['album','turne','koncert','kenge','single','klip','bashkepunim','grammy'],
 array[]::text[])

on conflict (slug) do update
  set title    = excluded.title,
      blurb    = excluded.blurb,
      anchors  = excluded.anchors,
      signals  = excluded.signals,
      excludes = excluded.excludes,
      updated_at = now();
