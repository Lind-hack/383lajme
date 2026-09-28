"use client";

import { useEffect, useState, type CSSProperties } from "react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import {
  LEAGUE_SCOPES,
  PUBLIC_LEAGUE_FEE,
  publicLeaguePrizes,
  scopeOf,
  type LeagueScopeKind,
} from "@/lib/tregu-leagues";
import styles from "./TreguAdminClient.module.css";

type AdminLeague = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  prizes: number[] | null;
  entry_fee: number;
  settled_at: string | null;
  members: number;
  pot: number;
  description: string | null;
  rules: string | null;
  emblem: string | null;
  color: string | null;
  cover_url: string | null;
  sponsor: string | null;
  scope_kind: LeagueScopeKind;
  scope_value: string | null;
};

type Draft = {
  name: string;
  scope: string;
  description: string;
  rules: string;
  emblem: string;
  color: string;
  cover_url: string;
  sponsor: string;
};

const scopeKey = (kind: string, value: string | null) => `${kind}:${value ?? ""}`;
const EMPTY: Draft = { name: "", scope: "all:", description: "", rules: "", emblem: "", color: "", cover_url: "", sponsor: "" };

/** Kosovo-local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function localInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** datetime-local is read as Kosovo time, whatever the admin's own clock says. */
function fromKosovoInput(value: string) {
  const guess = new Date(`${value}:00Z`);
  const offset = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Belgrade" })).getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

function formatWindow(start: string, end: string) {
  const fmt = (value: string) => new Date(value).toLocaleString("sq-AL", { timeZone: "Europe/Belgrade", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} → ${fmt(end)}`;
}

async function upload(file: File, kind: "emblem" | "cover") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const response = await fetch("/api/admin/tregu/leagues/upload", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return String(data.url);
}

function ProfileFields({ draft, setDraft, withScope }: { draft: Draft; setDraft: (next: Draft) => void; withScope: boolean }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, value] = draft.scope.split(":");
  const scope = LEAGUE_SCOPES.find((item) => scopeKey(item.kind, item.value) === draft.scope) ?? LEAGUE_SCOPES[0];

  const pick = async (file: File | undefined, field: "emblem" | "cover_url") => {
    if (!file) return;
    setUploading(field);
    setError(null);
    try {
      const url = await upload(file, field === "emblem" ? "emblem" : "cover");
      setDraft({ ...draft, [field]: url });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ngarkimi dështoi.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className={styles.leagueFields}>
      <label>Emri<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Liga e Tetorit" maxLength={40} /></label>
      {withScope && (
        <label>
          Tema (çfarë numërohet)
          <select value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })}>
            {LEAGUE_SCOPES.map((item) => (
              <option key={scopeKey(item.kind, item.value)} value={scopeKey(item.kind, item.value)}>{item.label}</option>
            ))}
          </select>
        </label>
      )}
      <label>Përshkrimi<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Vetëm tregjet e Champions League" maxLength={280} /></label>
      <label>Sponsori / shënim shpërblimi<input value={draft.sponsor} onChange={(event) => setDraft({ ...draft, sponsor: event.target.value })} placeholder="Sponsorizuar nga …" maxLength={120} /></label>
      <label className={styles.leagueWide}>Rregullat<textarea value={draft.rules} onChange={(event) => setDraft({ ...draft, rules: event.target.value })} rows={3} maxLength={1200} placeholder="Numërohen tregtitë që mbyllen gjatë ligës…" /></label>
      <label>
        Emblema (emoji ose ngarko)
        <span className={styles.leagueInline}>
          <input value={draft.emblem} onChange={(event) => setDraft({ ...draft, emblem: event.target.value })} placeholder={scope.emblem.startsWith("/") ? "imazhi i temës" : scope.emblem} />
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pick(event.target.files?.[0], "emblem")} aria-label="Ngarko emblemën" />
        </span>
      </label>
      <label>
        Ngjyra
        <span className={styles.leagueInline}>
          <input type="color" value={draft.color || scope.color} onChange={(event) => setDraft({ ...draft, color: event.target.value.toUpperCase() })} />
          <code>{draft.color || scope.color}</code>
        </span>
      </label>
      <label>
        Kopertina (ngarko)
        <span className={styles.leagueInline}>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pick(event.target.files?.[0], "cover_url")} aria-label="Ngarko kopertinën" />
          {draft.cover_url && <button type="button" className={styles.buttonSecondary} onClick={() => setDraft({ ...draft, cover_url: "" })}>Hiq</button>}
        </span>
      </label>
      <div className={styles.leaguePreview} style={{ "--lg-color": draft.color || scope.color, backgroundImage: draft.cover_url ? `linear-gradient(90deg, rgba(15,13,10,.85), rgba(15,13,10,.35)), url(${draft.cover_url})` : undefined } as CSSProperties}>
        <LeagueEmblem league={{ emblem: draft.emblem || null, color: draft.color || null, scope_kind: kind as LeagueScopeKind, scope_value: value || null, kind: "public", name: draft.name }} size={46} />
        <div>
          <strong>{draft.name || "Emri i ligës"}</strong>
          <span>{draft.description || scope.label}</span>
        </div>
      </div>
      {uploading && <p className={styles.notice}>Duke ngarkuar…</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
}

/** Public leagues: 383 pays 75% of the leaderboard prize for their length, the
 *  10-coin entries add to it, and winners go through Shpërblimet. */
export default function PublicLeagues() {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [startsAt, setStartsAt] = useState(() => localInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => localInput(new Date(Date.now() + 7 * 86_400_000)));
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const days = Math.max(1, Math.round((Date.parse(fromKosovoInput(endsAt)) - Date.parse(fromKosovoInput(startsAt))) / 86_400_000));
  const prizes = publicLeaguePrizes(days);

  const load = async () => {
    const response = await fetch("/api/admin/tregu/leagues", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setLeagues(data.leagues ?? []);
  };
  useEffect(() => { void load(); }, []);

  const send = async (method: "POST" | "PATCH", body: Record<string, unknown>, key: string) => {
    setSaving(key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/tregu/leagues", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      await load();
      return data;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Veprimi dështoi.");
      return null;
    } finally {
      setSaving(null);
    }
  };

  const profileBody = (value: Draft) => ({
    name: value.name,
    description: value.description,
    rules: value.rules,
    emblem: value.emblem,
    color: value.color,
    cover_url: value.cover_url,
    sponsor: value.sponsor,
  });

  const create = async () => {
    const [kind, value] = draft.scope.split(":");
    const result = await send("POST", {
      ...profileBody(draft),
      scope_kind: kind,
      scope_value: value || null,
      starts_at: fromKosovoInput(startsAt),
      ends_at: fromKosovoInput(endsAt),
    }, "create");
    if (result) {
      setDraft(EMPTY);
      setNotice("Liga u krijua.");
    }
  };

  const createAll = async () => {
    if (!window.confirm(`Krijo një ligë publike për çdo kategori (${LEAGUE_SCOPES.length}) për këtë periudhë?`)) return;
    const result = await send("POST", { bulk: true, starts_at: fromKosovoInput(startsAt), ends_at: fromKosovoInput(endsAt) }, "bulk");
    if (result) setNotice(result.created ? `U krijuan ${result.created} liga.` : "Çdo kategori ka tashmë një ligë në këtë periudhë.");
  };

  const status = (league: AdminLeague) => (league.settled_at ? "Mbyllur" : Date.parse(league.starts_at) > Date.now() ? "Fillon së shpejti" : "Aktive");

  return (
    <section className={styles.marketSection}>
      <header className={styles.sectionHeader}>
        <div>
          <h2>Ligat publike</h2>
          <p>Hyrja {PUBLIC_LEAGUE_FEE} 383C. 383 paguan 75% të shpërblimit të renditjes për kohëzgjatjen e ligës; tarifat shtohen në pot. Fituesit kalojnë te Shpërblimet për konfirmim.</p>
        </div>
        <span>{leagues.length}</span>
      </header>

      <fieldset className={styles.f1Config}>
        <legend>Ligë e re publike</legend>
        <div>
          <label>Fillon (ora e Kosovës)<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label>Mbaron (ora e Kosovës)<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
        </div>
        <p className={styles.notice}>
          {days} ditë → shpërblimet e 383: {prizes.map((prize) => `${prize} 383C`).join(" / ")} (baza {days <= 7 ? "javore" : "mujore"} × 75%) + poti i tarifave.
        </p>
        <ProfileFields draft={draft} setDraft={setDraft} withScope />
        <div className={styles.cardActions}>
          <button type="button" onClick={() => void create()} disabled={saving !== null || draft.name.trim().length < 3} className={styles.buttonPrimary}>
            {saving === "create" ? "Duke krijuar…" : "Krijo ligën"}
          </button>
          <button type="button" onClick={() => void createAll()} disabled={saving !== null} className={styles.buttonSecondary}>
            {saving === "bulk" ? "Duke krijuar…" : "Krijo një ligë për çdo kategori"}
          </button>
        </div>
        {notice && <p className={styles.notice}>{notice}</p>}
        {error && <p className={styles.errorMessage}>{error}</p>}
      </fieldset>

      {leagues.length ? (
        <div className={styles.withdrawalList}>
          {leagues.map((league) => (
            <article key={league.id} className={styles.withdrawalCard}>
              {editing?.id === league.id ? (
                <div style={{ width: "100%" }}>
                  <ProfileFields draft={editing.draft} setDraft={(next) => setEditing({ id: league.id, draft: next })} withScope={false} />
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.buttonPrimary}
                      disabled={saving !== null}
                      onClick={() => void send("PATCH", { id: league.id, ...profileBody(editing.draft) }, league.id).then((result) => result && setEditing(null))}
                    >
                      {saving === league.id ? "Duke ruajtur…" : "Ruaj profilin"}
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => setEditing(null)}>Anulo</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                    <LeagueEmblem league={{ ...league, kind: "public" }} size={40} />
                    <div style={{ minWidth: 0 }}>
                      <h3>{league.name}</h3>
                      <p>{scopeOf(league).label} · {formatWindow(league.starts_at, league.ends_at)} · {league.members} anëtarë · poti {league.pot} 383C</p>
                      <small>Shpërblimet e 383: {(league.prizes ?? []).map((prize) => `${prize} 383C`).join(" / ")}{league.sponsor ? ` · ${league.sponsor}` : ""}</small>
                    </div>
                  </div>
                  <div className={styles.withdrawalActions}>
                    <span className={styles.withdrawalStatus}>{status(league)}</span>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => setEditing({
                        id: league.id,
                        draft: {
                          name: league.name,
                          scope: scopeKey(league.scope_kind, league.scope_value),
                          description: league.description ?? "",
                          rules: league.rules ?? "",
                          emblem: league.emblem ?? "",
                          color: league.color ?? "",
                          cover_url: league.cover_url ?? "",
                          sponsor: league.sponsor ?? "",
                        },
                      })}
                    >
                      Ndrysho profilin
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>Asnjë ligë publike ende.</p>
      )}
    </section>
  );
}
