/** Reuses the consented usage identity; never sends interests or account IDs. */
export function measurePertyLoop(action: 'start' | 'complete' | 'follow'): boolean {
  try {
    if (localStorage.getItem('383_consent') !== 'granted') return false;
    const visitor = localStorage.getItem('383_usage_visitor') || crypto.randomUUID();
    localStorage.setItem('383_usage_visitor', visitor);
    const saved = JSON.parse(sessionStorage.getItem('383_usage_session') || 'null');
    const session = saved && Date.now() - saved.at < 30 * 60_000 ? saved.id : crypto.randomUUID();
    sessionStorage.setItem('383_usage_session', JSON.stringify({ id: session, at: Date.now() }));
    const body = JSON.stringify({ consent: 'granted', visitor, session, events: [{
      id: crypto.randomUUID(), kind: 'click', path: '/per-ty', action: `perty:${action}`,
    }] });
    void fetch('/api/analytics/usage', { method: 'POST', body,
      headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    return true;
  } catch { return false; }
}
