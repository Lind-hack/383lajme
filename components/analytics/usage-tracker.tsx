"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { buttonAction, publicPath } from '@/lib/usage-events.mjs';

type Event = { id: string; kind: 'page' | 'click' | 'active'; path: string; action?: string; target?: string; seconds?: number };

/** Anonymous feature measurements. No DOM text, form values, account IDs, or coordinates leave the browser. */
export default function UsageTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    const path = publicPath(pathname);
    if (!enabled || !path) return;
    let visitor: string, session: string;
    try {
      visitor = localStorage.getItem('383_usage_visitor') || crypto.randomUUID();
      localStorage.setItem('383_usage_visitor', visitor);
      const saved = JSON.parse(sessionStorage.getItem('383_usage_session') || 'null');
      session = saved && Date.now() - saved.at < 30 * 60_000 ? saved.id : crypto.randomUUID();
      sessionStorage.setItem('383_usage_session', JSON.stringify({ id: session, at: Date.now() }));
    } catch { return; }
    let queue: Event[] = [], lastTick = performance.now(), lastInteraction = performance.now();
    let lastActivityAt = Date.now(), persistedAt = 0;
    let visible = document.visibilityState === 'visible' && document.hasFocus();
    const allowed = () => { try { return localStorage.getItem('383_consent') === 'granted'; } catch { return false; } };
    const flush = (beacon = false) => {
      if (!queue.length || !allowed()) { queue = []; return; }
      const body = JSON.stringify({ consent: 'granted', visitor, session, events: queue.splice(0, 20) });
      if (beacon && navigator.sendBeacon('/api/analytics/usage', new Blob([body], { type: 'application/json' }))) return;
      void fetch('/api/analytics/usage', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    };
    const add = (event: Omit<Event, 'id' | 'path'>) => {
      if (!allowed()) return;
      queue.push({ ...event, id: crypto.randomUUID(), path });
      if (queue.length >= 16) flush();
    };
    const tick = () => {
      const now = performance.now();
      const seconds = Math.min(15, Math.floor((now - lastTick) / 1000));
      if (visible && now - lastInteraction <= 60_000 && seconds > 0) add({ kind: 'active', seconds });
      lastTick = now;
    };
    const activity = () => {
      const now = Date.now();
      if (now - lastActivityAt > 30 * 60_000) {
        flush(); session = crypto.randomUUID(); add({ kind: 'page' }); persistedAt = 0;
      }
      lastActivityAt = now;
      lastInteraction = performance.now();
      if (now - persistedAt > 5_000) {
        try { sessionStorage.setItem('383_usage_session', JSON.stringify({ id: session, at: now })); } catch {}
        persistedAt = now;
      }
    };
    const visibility = () => { tick(); visible = document.visibilityState === 'visible' && document.hasFocus(); if (visible) activity(); flush(true); };
    const leave = () => { tick(); flush(true); };
    const click = (event: MouseEvent) => {
      activity();
      const element = event.target instanceof Element ? event.target.closest('a,button,[role="button"]') : null;
      if (!element || element.closest('[data-usage-ignore],form')) return;
      if (element instanceof HTMLAnchorElement) {
        const target = publicPath(element.href);
        if (target) add({ kind: 'click', action: 'link', target });
      } else {
        add({ kind: 'click', action: buttonAction(element.getAttribute('data-usage-action') || element.getAttribute('aria-label') || element.textContent || '') });
      }
    };
    add({ kind: 'page' }); flush();
    const timer = window.setInterval(() => { tick(); flush(); }, 15_000);
    document.addEventListener('click', click, true);
    for (const name of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(name, activity, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility);
    window.addEventListener('blur', visibility);
    window.addEventListener('pagehide', leave);
    return () => {
      tick(); flush(true); clearInterval(timer);
      document.removeEventListener('click', click, true);
      for (const name of ['pointerdown', 'keydown', 'scroll']) document.removeEventListener(name, activity);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility); window.removeEventListener('blur', visibility);
      window.removeEventListener('pagehide', leave);
    };
  }, [enabled, pathname]);
  return null;
}
