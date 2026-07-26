const BASE = "https://api.openf1.org/v1";
const json = async (path, fetchImpl = fetch) => { for (let attempt=0; attempt<3; attempt++) { const r = await fetchImpl(`${BASE}${path}`); if (r.ok) return r.json(); if (r.status !== 429 || attempt === 2) throw new Error(`OpenF1 ${path}: ${r.status}`); await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1))); } };
const query = (path, params) => `${path}?${new URLSearchParams(params)}`;
export async function discoverHungary2026({ fetchImpl = fetch } = {}) {
 const meetings = await json(query('/meetings',{year:2026,meeting_name:'Hungarian Grand Prix'}), fetchImpl);
 if (meetings.length !== 1 || meetings[0].country_code !== 'HUN' || meetings[0].circuit_short_name !== 'Hungaroring') throw new Error('Verified Hungarian 2026 meeting unavailable');
 const sessions = await json(query('/sessions',{meeting_key:meetings[0].meeting_key}), fetchImpl);
 const race = sessions.find(s => s.session_type === 'Race'); const qualifying = sessions.find(s => s.session_type === 'Qualifying');
 if (!race || !qualifying) throw new Error('Verified Hungary race/qualifying session unavailable');
 const drivers = await json(query('/drivers',{session_key:race.session_key}), fetchImpl);
 if (drivers.length !== 22 || drivers.some(d => !d.name_acronym || !d.headshot_url || !d.team_colour)) throw new Error('Verified Hungary driver metadata incomplete');
 return { source_url: BASE, meeting: meetings[0], qualifying, race, drivers: drivers.map(d => ({ key:d.name_acronym, number:d.driver_number, label:d.full_name, team:d.team_name, team_color:`#${d.team_colour}`, headshot_url:d.headshot_url })) };
}
export async function fetchHungaryGridCandidate({fetchImpl=fetch}={}) {
 const event=await discoverHungary2026({fetchImpl}); const [positions,control]=await Promise.all([
  json(query('/position',{session_key:event.qualifying.session_key}),fetchImpl),json(query('/race_control',{session_key:event.qualifying.session_key}),fetchImpl)
 ]);
 const last=new Map(); for(const x of positions){ if(Number.isInteger(x.driver_number)&&Number.isInteger(x.position)) last.set(x.driver_number,x); }
 const byNumber=new Map(event.drivers.map(d=>[d.number,d]));
 const grid=[...last.values()].map(x=>({...byNumber.get(x.driver_number), qualifying_position:x.position})).filter(Boolean).sort((a,b)=>a.qualifying_position-b.qualifying_position);
 if(grid.length!==22 || new Set(grid.map(x=>x.key)).size!==22 || grid.some((x,i)=>x.qualifying_position!==i+1)) throw new Error('Qualifying order is incomplete or contradictory');
 const unresolved=control.filter(x=>/WILL BE INVESTIGATED|PENALTY|DISQUALIF|GRID DROP/i.test(String(x.message||''))).map(x=>x.message);
 return {event, status:unresolved.length?'pending_confirmed_penalties':'qualifying_order_verified', grid, unresolved, source_urls:[`${BASE}/position?session_key=${event.qualifying.session_key}`,`${BASE}/race_control?session_key=${event.qualifying.session_key}`]};
}
