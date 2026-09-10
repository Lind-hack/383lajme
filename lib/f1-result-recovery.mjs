import { openf1Headers } from "./openf1-auth.mjs";

/** Published classification for the exact configured session, never `latest`. */
export async function fetchF1FinalResult(market, { now = new Date(), fetchImpl = fetch } = {}) {
  const sessionKey = Number(market.live_event?.openf1_session_key);
  const raceStart = Date.parse(market.live_event?.race_start ?? "");
  if (market.market_type !== "f1_race_winner" || !Number.isInteger(sessionKey) || sessionKey <= 0 || !Number.isFinite(raceStart) || now.getTime() < raceStart + 3600000) return null;
  const get = async path => {
    const r = await fetchImpl(`https://api.openf1.org/v1/${path}`, { headers: await openf1Headers({ fetchImpl }), signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`OpenF1 classification: ${r.status}`);
    return r.json();
  };
  const sessions = await get(`sessions?session_key=${sessionKey}`);
  const session = sessions.find(s => Number(s.session_key) === sessionKey);
  if (session?.session_type !== "Race" || !Number.isFinite(Date.parse(session.date_start)) || Math.abs(Date.parse(session.date_start) - raceStart) > 3600000 || !Number.isFinite(Date.parse(session.date_end)) || now.getTime() <= Date.parse(session.date_end)) return null;
  const results = await get(`session_result?session_key=${sessionKey}`);
  if (!Array.isArray(results) || results.length < 20 || results.some(r => Number(r.session_key) !== sessionKey)) return null;
  const first = results.filter(r => Number(r.position) === 1 && !r.dsq && !r.dnf && !r.dns && Number(r.number_of_laps) > 0);
  if (first.length !== 1) return null;
  const winner = market.sport_outcomes?.find(o => Number(o.driver_number) === Number(first[0].driver_number))?.key;
  if (!winner) return null;
  const calendarUrl = `https://api.jolpi.ca/ergast/f1/${new Date(raceStart).getUTCFullYear()}.json`;
  const readResults = async url => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Jolpica classification: ${response.status}`);
    return (await response.json())?.MRData?.RaceTable?.Races ?? [];
  };
  const calendar = await readResults(calendarUrl);
  const matching = calendar.filter(row => row.date === new Date(raceStart).toISOString().slice(0,10));
  if (matching.length !== 1 || !/^\d+$/.test(String(matching[0].round))) return null;
  const corroborationUrl = calendarUrl.replace('.json', `/${matching[0].round}/results.json`);
  const races = await readResults(corroborationUrl);
  const officialWinners = races.filter(row => row.date === matching[0].date)
    .flatMap(row => row.Results ?? []).filter(row => String(row.position) === '1');
  if (officialWinners.length !== 1 || Number(officialWinners[0].number) !== Number(first[0].driver_number)
    || Number(officialWinners[0].laps) !== Number(first[0].number_of_laps)) return null;
  return { winner, session_key: sessionKey, rows: results, source_url: `https://api.openf1.org/v1/session_result?session_key=${sessionKey}`, corroboration_url: corroborationUrl, state_key: `f1-final:${sessionKey}:${winner}` };
}

export async function persistF1FinalResult(admin, market, result, now = new Date()) {
  // Close the trading deadline first. Buy/sell RPCs lock this same market row
  // and check closes_at, so a failed later request cannot expose final odds to
  // trading. Keep status=open until persistence completes so recovery retries.
  const { data: locked, error: lockError } = await admin.from("markets")
    .update({ closes_at: now.toISOString() }).eq("id", market.id).eq("status", "open").select("id").maybeSingle();
  if (lockError) throw new Error(lockError.message);
  if (!locked) return null;
  const outcomes = market.sport_outcomes;
  const probabilities = Object.fromEntries(outcomes.map(o => [o.key, o.key === result.winner ? .999 : .001 / (outcomes.length - 1)]));
  const state = { key: result.state_key, source_url: result.source_url, corroboration_url: result.corroboration_url, race: { status: "FINISHED", current_lap: Math.max(...result.rows.map(r => Number(r.number_of_laps) || 0)), total_laps: Math.max(...result.rows.map(r => Number(r.number_of_laps) || 0)) }, rows: result.rows.map(r => ({ ...r, driver_code: outcomes.find(o => Number(o.driver_number) === Number(r.driver_number))?.key })) };
  const { error } = await admin.rpc("apply_f1_race_winner_oracle", { p_market_id: market.id, p_state: state, p_probabilities: probabilities, p_evidence: [{ title: "Published race classification", url: result.source_url }], p_reasoning: "Exact-session published race result; live-timing recovery.", p_cap: .05, p_final: true, p_winner: result.winner });
  if (error) throw new Error(error.message);
  const { error: snapshotError } = await admin.rpc("record_f1_vector_snapshot", { p_market_id: market.id, p_state: state, p_probabilities: probabilities, p_reasoning: "Published final race classification" });
  if (snapshotError) throw new Error(snapshotError.message);
  const { error: closeError } = await admin.from("markets").update({ status: "closed", outcome: result.winner, official_final_at: now.toISOString(), settlement_due_at: now.toISOString(), closes_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", market.id).eq("status", "open").eq("live_score_state->>key", result.state_key);
  if (closeError) throw new Error(closeError.message);
  return state;
}
