"use client";

import { useEffect, useState } from "react";
import type { AutomationSnapshot } from "@/lib/automation-status";
import styles from "./automation.module.css";

const labels = { running: "Në punë", success: "Përfundoi", failed: "Dështoi", idle: "Në pritje" };
function time(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("sq-AL", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)) : "—";
}
function duration(start: string | null, end: string | null, now: number) {
  if (!start) return "—";
  const seconds = Math.max(0, Math.floor(((end ? Date.parse(end) : now) - Date.parse(start)) / 1000));
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
}
function safeUrl(url: string) { try { return new URL(url).protocol === "https:" ? url : undefined; } catch { return undefined; } }

export default function AutomationDashboard() {
  const [data, setData] = useState<AutomationSnapshot | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [category, setCategory] = useState("");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/admin/automation", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { window.location.href = "/admin"; return; }
        if (!response.ok) throw new Error("Statusi nuk u përditësua. Po provojmë përsëri.");
        const result = await response.json();
        if (!stopped) { setData(result); setError(""); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Lidhja dështoi."); }
      finally { if (!stopped) timer = setTimeout(refresh, 15000); }
    }
    refresh();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, []);
  const stale = !!data && now - Date.parse(data.generated_at) > 90000;
  return <main className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>383 · PANELI I PUNËS</p><h1>Automatizimet</h1><p>Çfarë po punon, çfarë gjeti dhe çfarë publikoi.</p></div><span className={styles.live}>{stale || error ? "Lidhja po kontrollohet" : data ? "Përditësim automatik" : "Duke u lidhur…"}</span></header>
    <p className={styles.meta}>Ora e Kosovës · Përditësohet çdo 15 sekonda{data && ` · Raporti i fundit: ${time(data.generated_at)}`}</p>
    {error && <p role="alert" className={styles.warning}>{error}</p>}
    {stale && <p role="alert" className={styles.warning}>Serveri nuk ka dërguar raport të ri. Më poshtë është gjendja e fundit e njohur; kohëmatësi është ndalur.</p>}
    {!data && !error && <p role="status">Duke lexuar gjendjen e automatizimeve…</p>}
    {data && <>
      <section className={styles.jobs} aria-label="Gjendja e punëve">{data.jobs.map(job => <article className={styles.card} key={job.id}>
        <div className={styles.row}><h2>{job.name}</h2><span className={styles.badge} data-state={stale ? "idle" : job.status}>{stale ? "Gjendja e fundit" : labels[job.status]}</span></div>
        <div className={styles.duration}>{duration(job.started_at, job.status === "running" ? null : job.finished_at, stale ? Date.parse(data.generated_at) : now)}</div>
        <p className={styles.stage}>{job.stage || "Në pritje të nisjes"}</p>
        <dl><dt>Nisi</dt><dd>{time(job.started_at)}</dd><dt>Përfundoi</dt><dd>{job.status === "running" ? "Ende në punë" : time(job.finished_at)}</dd><dt>Ekzekutimi tjetër</dt><dd>{time(job.next_run)}</dd><dt>Orari</dt><dd>{job.schedule}</dd><dt>Planifikimi</dt><dd>{job.enabled ? "Aktiv" : "Joaktiv"}</dd></dl>
        {job.result && <p className={styles.result}>{job.result}</p>}{job.error && <p className={styles.warning}>{job.error}</p>}
      </article>)}</section>
      <section className={styles.section}><div className={styles.row}><h2>Çfarë gjeti kërkimi i lajmeve</h2><strong>{data.news.leads} kandidatë</strong></div><p className={styles.meta}>{time(data.news.discovered_at)} · {data.news.working_feeds}/{data.news.total_feeds} burime funksionale. Kandidatët ende kërkojnë verifikim.</p>
        <div className={styles.filters}><button aria-pressed={!category} onClick={() => setCategory("")}>Të gjitha</button>{Object.entries(data.news.categories).map(([name, count]) => <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name} <b>{count}</b></button>)}</div>
        <ul className={styles.list}>{data.news.stories.filter(s => !category || s.category === category).map((story, i) => <li key={story.url + i}><a href={safeUrl(story.url)} target="_blank" rel="noopener noreferrer">{story.title}</a><span>{story.category} · {story.source}</span></li>)}</ul>
        {!data.news.stories.length && <p>Nuk ka kandidatë të regjistruar ende.</p>}
      </section>
      <section className={styles.section}><h2>Artikujt dhe rezultatet</h2><p className={styles.meta}>Draftet nuk llogariten si publikime. Shfaqen deri në 12 grupe të fundit.</p>{data.news.batches.map(batch => <details key={batch.hour} className={styles.batch}><summary>{batch.hour.replace("T", " · ")}:00 · {batch.count} artikuj <span className={styles.badge} data-state={batch.published ? "success" : "idle"}>{batch.published ? "Publikim i verifikuar" : "Drafte / të paverifikuara"}</span></summary><ul className={styles.list}>{batch.articles.map((a, i) => <li key={a.slug + i}>{batch.published ? <a href={`/article/${encodeURIComponent(a.slug)}`} target="_blank" rel="noopener noreferrer">{a.title}</a> : <strong>{a.title}</strong>}<span>{a.category}</span></li>)}</ul></details>)}{!data.news.batches.length && <p>Nuk ka grupe artikujsh ende.</p>}</section>
      <section className={styles.section}><div className={styles.row}><h2>Kërkimi në rrjetet sociale</h2><strong>{data.social.videos.length} video / postime</strong></div><p className={styles.meta}>{time(data.social.checked_at)} · {data.social.usable}/{data.social.watchlists} kërkime me rezultate. Video publike dhe burime pa API key; qasja ndryshon sipas platformës.</p><ul className={styles.list}>{data.social.videos.map((v, i) => <li key={v.url + i}><a href={safeUrl(v.url)} target="_blank" rel="noopener noreferrer">{v.title}</a><span>{v.publisher} · {time(v.published || null)}</span></li>)}</ul>{!data.social.videos.length && <p>Nuk u gjetën postime të përdorshme në kërkimin e fundit.</p>}</section>
      <p className={styles.meta}>Për rezultatet e hollësishme të tregjeve: <a href="/admin/tregu/refreshet">hap historikun e Tregut</a>.</p>
    </>}
  </main>;
}
