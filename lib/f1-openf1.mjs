const BASE = "https://api.openf1.org/v1";
const json = async (path, fetchImpl = fetch) => { const r = await fetchImpl(`${BASE}${path}`); if (!r.ok) throw new Error(`OpenF1 ${path}: ${r.status}`); return r.json(); };
export async function discoverHungary2026({ fetchImpl = fetch } = {}) {
 const meetings = await json('/meetings?year=2026&meeting_name=Hungarian%20Grand%20Prix', fetchImpl);
 if (meetings.length !== 1 || meetings[0].country_code !== 'HUN' || meetings[0].circuit_short_name !== 'Hungaroring') throw new Error('Verified Hungarian 2026 meeting unavailable');
 const sessions = await json(`/sessions?meeting_key=${meetings[0].meeting_key}`, fetchImpl);
 const race = sessions.find(s => s.session_type === 'Race'); const qualifying = sessions.find(s => s.session_type === 'Qualifying');
 if (!race || !qualifying) throw new Error('Verified Hungary race/qualifying session unavailable');
 const drivers = await json(`/drivers?session_key=${race.session_key}`, fetchImpl);
 if (drivers.length < 20 || drivers.some(d => !d.name_acronym || !d.headshot_url)) throw new Error('Verified Hungary driver metadata incomplete');
 return { source_url: BASE, meeting: meetings[0], qualifying, race, drivers: drivers.map(d => ({ key:d.name_acronym, label:d.full_name, team:d.team_name, team_color:`#${d.team_colour}`, headshot_url:d.headshot_url })) };
}
