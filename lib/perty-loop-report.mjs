import { kosovoLocalDate } from './tregu-date-key.mjs';

const offsetDay = (day, offset) => new Date(Date.parse(day + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
const ratio = (count, denominator) => ({ count, denominator, rate: denominator ? count / denominator : null });

/** Daily cohorts, not sessions. A return is an edition start on D+1 in Kosovo. */
export function pertyLoopReport(events, now = new Date()) {
  const today = kosovoLocalDate(now);
  const days = new Map();
  for (const e of events) {
    if (e.path !== '/per-ty' || !e.visitor_hash || !Number.isFinite(Date.parse(e.created_at))) continue;
    const day = kosovoLocalDate(new Date(e.created_at));
    if (day > today || day < offsetDay(today, -6)) continue;
    if (!days.has(day)) days.set(day, { starts: new Set(), completions: new Set(), follows: new Set(), visits: new Set() });
    const row = days.get(day);
    if (e.kind === 'page') row.visits.add(e.visitor_hash);
    if (e.action === 'perty:start') row.starts.add(e.visitor_hash);
    if (e.action === 'perty:complete') row.completions.add(e.visitor_hash);
    if (e.action === 'perty:follow') row.follows.add(e.visitor_hash);
  }
  const cohorts = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, row]) => {
    const next = days.get(offsetDay(day, 1));
    const mature = offsetDay(day, 1) < today;
    const completed = [...row.starts].filter(id => row.completions.has(id));
    const followed = [...row.follows].filter(id => row.starts.has(id)).length;
    return { day, visitors: row.visits.size, starters: row.starts.size, followers: row.follows.size,
      followToStart: ratio(followed, row.follows.size),
      completion: ratio(completed.length, row.starts.size),
      nextDay: { status: mature ? 'mature' : 'pending',
        starters: mature ? ratio([...row.starts].filter(id => next?.starts.has(id)).length, row.starts.size) : null,
        completers: mature ? ratio(completed.filter(id => next?.starts.has(id)).length, completed.length) : null,
        // Historical page views provide a visit-only baseline before instrumentation.
        visitors: mature ? ratio([...row.visits].filter(id => next?.visits.has(id)).length, row.visits.size) : null },
    };
  });
  return { generatedAt: now.toISOString(), timezone: 'Europe/Belgrade',
    scope: 'Consenting browsers only; daily cohorts, deduplicated by visitor hash. Not people or acquisition cohorts.',
    completionDefinition: 'All personal-edition items opened or summary/excerpt at least half visible in a focused tab for 4 seconds. Must-knows excluded. Proxy, not proof of reading.',
    nextDayDefinition: 'Edition start on the next Kosovo calendar day. Pending until that entire day has elapsed.',
    retentionDays: 7, cohorts };
}
