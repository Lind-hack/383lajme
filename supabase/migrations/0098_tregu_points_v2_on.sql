-- 383 Tregu — switch new leagues to scoring v2 (🔥 Seria, ⭐ Kartë e artë).
--
-- Apply ONLY after Railway reports the round-2 UI live (/api/deployment-info).
-- 0097 added everything with the default left at 1; this flips it, so every
-- league created from now on (readers' and admin's) scores v2. Existing
-- leagues keep rules_version 1 and today's scoring.

alter table public.tregu_leagues alter column rules_version set default 2;
