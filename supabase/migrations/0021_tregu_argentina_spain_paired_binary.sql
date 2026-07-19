-- 0021 — Atomically adapt the two legacy Argentina–Spain PO/JO markets to ESPN 760517.
-- Oracle writes bounded LMSR state/evidence only; user positions, balances, and ledgers are never touched.
create or replace function public.apply_paired_binary_sport_oracle(
  p_spain_market_id uuid, p_argentina_market_id uuid, p_event_id text, p_state jsonb,
  p_spain_reference_probability numeric, p_evidence jsonb, p_reasoning text, p_requested_cap numeric,
  p_close_market boolean, p_spain_outcome text, p_argentina_outcome text, p_settlement_due_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_spain record; v_argentina record; v_cap numeric; v_spain_current numeric; v_argentina_current numeric;
  v_spain_target numeric; v_argentina_target numeric; v_delta numeric; v_volume numeric;
begin
  if p_event_id <> '760517' or coalesce(p_state->>'key', '') = '' then raise exception 'Kërkohet eventi zyrtar ESPN 760517'; end if;
  if p_spain_market_id is null or p_argentina_market_id is null or p_spain_market_id = p_argentina_market_id then raise exception 'Çifti binar është i pavlefshëm'; end if;
  if p_spain_reference_probability is null or p_spain_reference_probability <= 0 or p_spain_reference_probability >= 1 then raise exception 'Probabiliteti i Spanjës duhet të jetë i fundëm'; end if;
  if jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) = 0 then raise exception 'Oracle kërkon provë zyrtare'; end if;
  if p_close_market and (not (coalesce(p_state->>'status', '') ~* '(FINAL|POST|CANCELED|FULL_TIME)' or upper(trim(coalesce(p_state->>'detail', ''))) = 'FT') or p_spain_outcome not in ('PO','JO') or p_argentina_outcome not in ('PO','JO') or p_settlement_due_at is null) then raise exception 'Vetëm finalja zyrtare ESPN mund të mbyllë çiftin'; end if;

  -- One lock scope makes this complementary update atomic and repeat-safe.
  select * into v_spain from public.markets where id = p_spain_market_id for update;
  select * into v_argentina from public.markets where id = p_argentina_market_id for update;
  if v_spain.id is null or v_argentina.id is null or v_spain.status <> 'open' or v_argentina.status <> 'open' or v_spain.slug <> 'argjentina-spanja-fiton-spanja' or v_argentina.slug <> 'argjentina-spanja-fiton-argjentina' then raise exception 'Tregu binar i çiftuar nuk përputhet'; end if;
  if v_spain.live_score_state->>'key' = p_state->>'key' and v_argentina.live_score_state->>'key' = p_state->>'key' then return; end if;

  v_cap := least(0.10, greatest(0.001, p_requested_cap));
  v_spain_current := public.lmsr_price_yes(v_spain.q_yes, v_spain.q_no, v_spain.b);
  v_argentina_current := public.lmsr_price_yes(v_argentina.q_yes, v_argentina.q_no, v_argentina.b);
  v_spain_target := least(v_spain_current + v_cap, greatest(v_spain_current - v_cap, p_spain_reference_probability));
  v_argentina_target := least(v_argentina_current + v_cap, greatest(v_argentina_current - v_cap, 1 - p_spain_reference_probability));
  v_delta := v_spain.b * (ln(v_spain_target / (1 - v_spain_target)) - ln(v_spain_current / (1 - v_spain_current)));
  update public.markets set q_yes = q_yes + v_delta / 2, q_no = q_no - v_delta / 2, live_event = jsonb_build_object('provider','espn','event_id','760517','league','fifa.world','sport','soccer'), live_score_state = p_state, status = case when p_close_market then 'closed' else 'open' end, official_final_at = case when p_close_market then now() else official_final_at end, settlement_due_at = case when p_close_market then p_settlement_due_at else settlement_due_at end, outcome = case when p_close_market then p_spain_outcome else outcome end, closes_at = case when p_close_market then least(closes_at, now()) else closes_at end, updated_at = now() where id = p_spain_market_id;
  v_delta := v_argentina.b * (ln(v_argentina_target / (1 - v_argentina_target)) - ln(v_argentina_current / (1 - v_argentina_current)));
  update public.markets set q_yes = q_yes + v_delta / 2, q_no = q_no - v_delta / 2, live_event = jsonb_build_object('provider','espn','event_id','760517','league','fifa.world','sport','soccer'), live_score_state = p_state, status = case when p_close_market then 'closed' else 'open' end, official_final_at = case when p_close_market then now() else official_final_at end, settlement_due_at = case when p_close_market then p_settlement_due_at else settlement_due_at end, outcome = case when p_close_market then p_argentina_outcome else outcome end, closes_at = case when p_close_market then least(closes_at, now()) else closes_at end, updated_at = now() where id = p_argentina_market_id;

  select coalesce(sum(abs(amount)), 0) into v_volume from public.transactions where market_id in (p_spain_market_id, p_argentina_market_id) and type = 'bet';
  insert into public.market_snapshots (market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning, evidence_slugs, evidence, evidence_sources, market_prob_before, market_prob, oracle_cap, volume) values
    (p_spain_market_id, p_spain_reference_probability, p_spain_reference_probability, 'live_score', p_reasoning, array['espn:760517'], p_evidence, array['ESPN official scoreboard'], v_spain_current, v_spain_target, v_cap, v_volume),
    (p_argentina_market_id, 1-p_spain_reference_probability, 1-p_spain_reference_probability, 'live_score', p_reasoning, array['espn:760517'], p_evidence, array['ESPN official scoreboard'], v_argentina_current, v_argentina_target, v_cap, v_volume);
end;
$$;
revoke all on function public.apply_paired_binary_sport_oracle(uuid, uuid, text, jsonb, numeric, jsonb, text, numeric, boolean, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_paired_binary_sport_oracle(uuid, uuid, text, jsonb, numeric, jsonb, text, numeric, boolean, text, text, timestamptz) to service_role;
