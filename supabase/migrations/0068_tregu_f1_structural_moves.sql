-- Structural F1 events are allowed past the five-point cap.
--
-- 0049 clamps every move with `least(0.05, ...)`, which is right for a market
-- reacting to reporting: a single misread sentence should never be able to
-- crater a book. It is wrong for a fact. When a driver takes a grid penalty
-- that puts him at the back, or withdraws, or is disqualified, the honest price
-- is reached in one step -- and under the old clamp a driver who cannot win
-- would keep being quoted at double figures for the eight minutes it took four
-- two-minute ticks to bleed him down.
--
-- The release is per driver and opt-in: the caller names the keys it has
-- verified as structural, those move to the model's number outright, and every
-- other outcome keeps the 0.05 cap. Renormalisation then redistributes to the
-- rest of the field as it always did. Callers that pass nothing get exactly the
-- old behaviour, which is why the parameter is defaulted rather than required.

drop function if exists public.apply_f1_race_winner_oracle(uuid, jsonb, jsonb, jsonb, text, numeric, boolean, text);
drop function if exists public.apply_f1_race_winner_oracle(uuid, jsonb, jsonb, jsonb, text, numeric, boolean, text, jsonb);

create or replace function public.apply_f1_race_winner_oracle(
  p_market_id uuid,
  p_state jsonb,
  p_probabilities jsonb,
  p_evidence jsonb,
  p_reasoning text,
  p_cap numeric,
  p_final boolean,
  p_winner text,
  p_structural_keys jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_item jsonb;
  v_key text;
  v_current numeric;
  v_target numeric;
  v_sum numeric := 0;
  v_count integer;
  v_cap numeric;
  v_new jsonb := '{}'::jsonb;
  v_quantities jsonb := '{}'::jsonb;
  v_winner text := upper(coalesce(p_winner, ''));
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found
     or v_market.status <> 'open'
     or v_market.market_classification <> 'live_f1'
     or v_market.market_type <> 'f1_race_winner'
     or v_market.live_event->>'provider' <> 'formula1_dashboard'
     or jsonb_typeof(v_market.sport_outcomes) <> 'array'
     or jsonb_array_length(v_market.sport_outcomes) < 20
     or jsonb_array_length(v_market.sport_outcomes) > 22 then
    raise exception 'F1 race-winner market is not configured for vector updates';
  end if;
  if p_state is null or coalesce(p_state->>'key', '') = '' then
    raise exception 'F1 timing/pre-match state key is required';
  end if;
  if v_market.live_score_state->>'key' = p_state->>'key' then
    return;
  end if;
  if jsonb_typeof(p_probabilities) <> 'object' then
    raise exception 'F1 probabilities must be a JSON object';
  end if;

  v_count := jsonb_array_length(v_market.sport_outcomes);
  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) loop
    v_key := v_item->>'key';
    v_target := (p_probabilities->>v_key)::numeric;
    if v_target is null or v_target < 0 or v_target > 1 then
      raise exception 'F1 probability is invalid for %', v_key;
    end if;
    v_sum := v_sum + v_target;
  end loop;
  if abs(v_sum - 1) > 0.000001 then
    raise exception 'F1 probabilities must sum to one';
  end if;

  if p_final then
    if v_winner = '' or not exists (select 1 from jsonb_array_elements(v_market.sport_outcomes) value where value->>'key' = v_winner) then
      raise exception 'F1 final winner is not a configured driver';
    end if;
  end if;
  v_cap := least(0.05, greatest(0.001, coalesce(p_cap, 0.05)));

  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) loop
    v_key := v_item->>'key';
    v_current := coalesce((v_market.reference_probabilities->>v_key)::numeric, 1.0 / v_count);
    if p_final then
      v_target := case when v_key = v_winner then 0.999 else 0.001 / greatest(v_count - 1, 1) end;
    else
      -- Never write a literal zero into the LMSR quantity; a verified DNF/DNS
      -- is represented by the documented floor while remaining visibly retired.
      if p_structural_keys ? v_key then
        -- A grid penalty, a withdrawal or a disqualification is a fact about
        -- the race, not an opinion about a driver. The five-point cap exists to
        -- stop one loose reading of the news cratering a market; it must not
        -- also stop a driver who is starting last, or not starting at all, from
        -- being priced that way. Only the named drivers are released, and every
        -- other outcome is still capped, so the book redistributes normally.
        v_target := greatest(0.000001, (p_probabilities->>v_key)::numeric);
      else
        v_target := greatest(0.000001, least(v_current + v_cap, greatest(v_current - v_cap, (p_probabilities->>v_key)::numeric)));
      end if;
    end if;
    v_new := v_new || jsonb_build_object(v_key, v_target);
  end loop;

  -- Renormalize after the independent movement caps.
  v_sum := (select sum(value::numeric) from jsonb_each_text(v_new));
  v_new := (
    select jsonb_object_agg(key, value::numeric / v_sum)
    from jsonb_each_text(v_new)
  );
  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) loop
    v_key := v_item->>'key';
    v_quantities := v_quantities || jsonb_build_object(
      v_key,
      v_market.b * ln(greatest((v_new->>v_key)::numeric, 0.000001))
    );
  end loop;

  update public.markets
     set outcome_quantities = v_quantities,
         reference_probabilities = v_new,
         live_score_state = p_state,
         updated_at = now()
   where id = v_market.id;
end;
$$;
