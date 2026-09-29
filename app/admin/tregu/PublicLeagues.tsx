"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import PublicLeagueCard from "@/components/tregu/public-league-card";
import { fmtNum } from "@/lib/format";
import {
  LEAGUE_COLORS,
  LEAGUE_SCOPES,
  PUBLIC_LEAGUE_FEE,
  isImageEmblem,
  potSplit,
  publicLeaguePrizes,
  scopeOf,
  type LeagueScope,
  type LeagueScopeKind,
} from "@/lib/tregu-leagues";
import "@/components/tregu/leagues.css";
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
  featured: boolean;
  feature_order: number;
};

type Draft = {
  scope: string;
  name: string;
  description: string;
  rules: string;
  sponsor: string;
  emblem: string;
  color: string;
  startsAt: string;
  endsAt: string;
  fee: string;
  prizes: [string, string, string];
  featured: boolean;
};

const scopeKey = (kind: string, value: string | null) => `${kind}:${value ?? ""}`;
const GROUPS: { title: string; kinds: LeagueScopeKind[] }[] = [
  { title: "Gjithçka", kinds: ["all"] },
  { title: "Kategori e plotë", kinds: ["category"] },
  { title: "Garë", kinds: ["competition"] },
  { title: "Formula 1", kinds: ["f1"] },
];

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

function daysBetween(start: string, end: string) {
  return Math.max(1, Math.round((Date.parse(fromKosovoInput(end)) - Date.parse(fromKosovoInput(start))) / 86_400_000));
}

function freshDraft(): Draft {
  const start = localInput(new Date());
  const end = localInput(new Date(Date.now() + 7 * 86_400_000));
  const prizes = publicLeaguePrizes(7).map(String) as [string, string, string];
  return { scope: "all:", name: "", description: "", rules: "", sponsor: "", emblem: "", color: "", startsAt: start, endsAt: end, fee: String(PUBLIC_LEAGUE_FEE), prizes, featured: true };
}

/**
 * Admin → Ligat. One builder, four decisions in the order they matter: what
 * counts, when, what it pays, how it looks. The card on the right is the real
 * public league card, so what you see is what players see. Money and dates
 * can still change until the first player joins.
 */
export default function PublicLeagues() {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [editing, setEditing] = useState<AdminLeague | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [now] = useState(() => Date.now());

  const load = async () => {
    const response = await fetch("/api/admin/tregu/leagues", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setLeagues(data.leagues ?? []);
  };
  useEffect(() => { void load(); }, []);

  const scope: LeagueScope = LEAGUE_SCOPES.find((item) => scopeKey(item.kind, item.value) === draft.scope) ?? LEAGUE_SCOPES[0];
  const days = daysBetween(draft.startsAt, draft.endsAt);
  const fee = Math.max(0, Math.round(Number(draft.fee) || 0));
  const prizes = draft.prizes.map((value) => Math.max(0, Math.round(Number(value) || 0)));
  const moneyLocked = Boolean(editing && editing.members > 0);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const preview = useMemo(() => ({
    id: "preview",
    name: draft.name.trim() || (scope.kind === "all" ? "Liga e Javës" : `${scope.label} · Liga`),
    kind: "public" as const,
    starts_at: fromKosovoInput(draft.startsAt),
    ends_at: fromKosovoInput(draft.endsAt),
    entry_fee: fee,
    prizes,
    pot: editing?.pot ?? 0,
    members: editing?.members ?? 0,
    settled: false,
    emblem: draft.emblem || null,
    color: draft.color || null,
    scope_kind: scope.kind,
    scope_value: scope.value,
    sponsor: draft.sponsor || null,
  }), [draft, editing, fee, prizes, scope]);

  const pickScope = (item: LeagueScope) => {
    if (editing) return;
    set({ scope: scopeKey(item.kind, item.value) });
  };

  const pickLength = (length: number) => {
    const start = new Date();
    set({ startsAt: localInput(start), endsAt: localInput(new Date(start.getTime() + length * 86_400_000)) });
    if (!moneyLocked) set({ prizes: publicLeaguePrizes(length).map(String) as [string, string, string] });
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      set({ emblem: await upload(file, "emblem") });
    } catch (reason) {
      setMessage({ ok: false, text: reason instanceof Error ? reason.message : "Ngarkimi dështoi." });
    } finally {
      setUploading(false);
    }
  };

  const send = async (method: "POST" | "PATCH", body: Record<string, unknown>, key: string) => {
    setSaving(key);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/tregu/leagues", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      await load();
      return data;
    } catch (reason) {
      setMessage({ ok: false, text: reason instanceof Error ? reason.message : "Veprimi dështoi." });
      return null;
    } finally {
      setSaving(null);
    }
  };

  const profile = () => ({
    name: preview.name,
    description: draft.description,
    rules: draft.rules,
    emblem: draft.emblem,
    color: draft.color,
    sponsor: draft.sponsor,
  });
  const money = () => ({ entry_fee: fee, prizes, starts_at: fromKosovoInput(draft.startsAt), ends_at: fromKosovoInput(draft.endsAt) });

  const save = async () => {
    if (editing) {
      const result = await send("PATCH", { id: editing.id, ...profile(), featured: draft.featured, ...(moneyLocked ? {} : money()) }, "save");
      if (result) {
        setEditing(null);
        setDraft(freshDraft());
        setMessage({ ok: true, text: "Liga u ruajt." });
      }
      return;
    }
    const result = await send("POST", { ...profile(), ...money(), scope_kind: scope.kind, scope_value: scope.value }, "save");
    if (result?.id) {
      if (draft.featured) await send("PATCH", { id: result.id, featured: true }, "save");
      setDraft(freshDraft());
      setMessage({ ok: true, text: "Liga u krijua dhe është gati për lojtarët." });
    }
  };

  const createAll = async () => {
    if (!window.confirm(`Krijo një ligë për çdo kategori (${LEAGUE_SCOPES.length}) nga ${formatWindow(fromKosovoInput(draft.startsAt), fromKosovoInput(draft.endsAt))}, hyrja ${fee}, shpërblimet ${prizes.join(" / ")}?`)) return;
    const result = await send("POST", { bulk: true, ...money() }, "bulk");
    if (result) setMessage({ ok: true, text: result.created ? `U krijuan ${result.created} liga.` : "Çdo kategori ka tashmë një ligë në këtë periudhë." });
  };

  const edit = (league: AdminLeague) => {
    setEditing(league);
    setMessage(null);
    setDraft({
      scope: scopeKey(league.scope_kind, league.scope_value),
      name: league.name,
      description: league.description ?? "",
      rules: league.rules ?? "",
      sponsor: league.sponsor ?? "",
      emblem: league.emblem ?? "",
      color: league.color ?? "",
      startsAt: localInput(new Date(league.starts_at)),
      endsAt: localInput(new Date(league.ends_at)),
      fee: String(league.entry_fee),
      prizes: [0, 1, 2].map((index) => String(league.prizes?.[index] ?? 0)) as [string, string, string],
      featured: league.featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const status = (league: AdminLeague) => (league.settled_at ? "Mbyllur" : Date.parse(league.ends_at) <= Date.now() ? "Pret rezultatet" : Date.parse(league.starts_at) > Date.now() ? "Fillon së shpejti" : "Aktive");
  const example = 20;
  const examplePot = fee * example;
  const exampleSplit = potSplit(examplePot, 3).map((share, index) => share + (prizes[index] ?? 0));

  return (
    <section className={styles.marketSection}>
      <header className={styles.sectionHeader}>
        <div>
          <h2>{editing ? `Ndrysho: ${editing.name}` : "Ligat publike"}</h2>
          <p>Lojtarët parashikojnë tregjet që zgjedh këtu. Pikët: 100 minus gjasa kur zgjodhën. Fituesit e ligave publike presin konfirmimin tënd te Shpërblimet.</p>
        </div>
        <span>{leagues.length}</span>
      </header>

      <div className="lgb">
        <div className="lgb-steps">
          <section className="lgb-step">
            <h3><span>1</span> Çfarë numërohet</h3>
            <p>{editing ? "Tema nuk ndryshon pasi liga krijohet." : "Zgjidh tregjet që lojtarët parashikojnë në këtë ligë."}</p>
            {GROUPS.map((group) => (
              <div key={group.title} className="lgb-group">
                <small>{group.title}</small>
                <div className="lgb-tiles">
                  {LEAGUE_SCOPES.filter((item) => group.kinds.includes(item.kind)).map((item) => (
                    <button
                      key={scopeKey(item.kind, item.value)}
                      type="button"
                      className="lgb-tile"
                      aria-pressed={draft.scope === scopeKey(item.kind, item.value)}
                      disabled={Boolean(editing)}
                      onClick={() => pickScope(item)}
                    >
                      <LeagueEmblem league={{ emblem: item.emblem, color: item.color, kind: "public", name: item.label, scope_kind: item.kind, scope_value: item.value }} size={34} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="lgb-step">
            <h3><span>2</span> Kur</h3>
            <div className="lgb-inline">
              <button type="button" className="lg-ghost" disabled={moneyLocked} onClick={() => pickLength(7)}>Një javë</button>
              <button type="button" className="lg-ghost" disabled={moneyLocked} onClick={() => pickLength(30)}>Një muaj</button>
            </div>
            <div className="lgb-fields">
              <label>Fillon (ora e Kosovës)<input type="datetime-local" value={draft.startsAt} disabled={moneyLocked} onChange={(event) => set({ startsAt: event.target.value })} /></label>
              <label>Mbaron (ora e Kosovës)<input type="datetime-local" value={draft.endsAt} disabled={moneyLocked} onChange={(event) => set({ endsAt: event.target.value })} /></label>
            </div>
            <p>{days} ditë. Numërohen tregjet që nisin brenda kësaj kohe.</p>
          </section>

          <section className="lgb-step">
            <h3><span>3</span> Shpërblimet</h3>
            {moneyLocked && <p>Dikush ka hyrë tashmë: hyrja, shpërblimet dhe datat nuk ndryshojnë më.</p>}
            <div className="lgb-fields">
              <label>Hyrja (383C, 0 = falas)<input inputMode="numeric" value={draft.fee} disabled={moneyLocked} onChange={(event) => set({ fee: event.target.value.replace(/\D/g, "").slice(0, 5) })} /></label>
              <label>
                &nbsp;
                <button type="button" className="lg-ghost" disabled={moneyLocked} onClick={() => set({ prizes: publicLeaguePrizes(days).map(String) as [string, string, string] })}>Përdor sugjerimin për {days <= 7 ? "javën" : "muajin"}</button>
              </label>
            </div>
            <div className="lgb-prizes">
              {["1-rë", "2-të", "3-të"].map((place, index) => (
                <label key={place}>
                  {place} nga 383
                  <input
                    inputMode="numeric"
                    value={draft.prizes[index]}
                    disabled={moneyLocked}
                    onChange={(event) => {
                      const next = [...draft.prizes] as [string, string, string];
                      next[index] = event.target.value.replace(/\D/g, "").slice(0, 6);
                      set({ prizes: next });
                    }}
                  />
                </label>
              ))}
            </div>
            <p>
              Me {example} lojtarë: hyrjet {fmtNum(examplePot)} + shpërblimet e 383 → {exampleSplit.map((value) => fmtNum(value)).join(" / ")} 383C.
              383 paguan {fmtNum(prizes.reduce((sum, value) => sum + value, 0))} 383C nëse ka tre fitues me pikë.
            </p>
          </section>

          <section className="lgb-step">
            <h3><span>4</span> Pamja</h3>
            <div className="lgb-fields">
              <label>Emri<input value={draft.name} maxLength={40} onChange={(event) => set({ name: event.target.value })} placeholder={preview.name} /></label>
              <label>Sponsori / shënim<input value={draft.sponsor} maxLength={120} onChange={(event) => set({ sponsor: event.target.value })} placeholder="Sponsorizuar nga …" /></label>
              <label data-wide>Përshkrimi<input value={draft.description} maxLength={280} onChange={(event) => set({ description: event.target.value })} placeholder={`Parashiko tregjet e ${scope.label}.`} /></label>
              <label data-wide>Rregulla shtesë<textarea value={draft.rules} maxLength={1200} onChange={(event) => set({ rules: event.target.value })} placeholder="Opsionale. Rregullat e pikëve shfaqen gjithsesi." /></label>
              <label>
                Emblema: emoji ose foto
                <span className="lgb-inline">
                  <input value={isImageEmblem(draft.emblem) ? "" : draft.emblem} onChange={(event) => set({ emblem: event.target.value.slice(0, 16) })} placeholder={scope.emblem.startsWith("/") ? "logo e temës" : scope.emblem} style={{ width: 120 }} />
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pickFile(event.target.files?.[0])} aria-label="Ngarko emblemën" />
                  {draft.emblem && <button type="button" className="lg-ghost" onClick={() => set({ emblem: "" })}>Rikthe logon e temës</button>}
                </span>
                {uploading && <small>Duke ngarkuar…</small>}
              </label>
              <label>
                Ngjyra
                <span className="lgb-swatches">
                  {[scope.color, ...LEAGUE_COLORS.filter((color) => color !== scope.color)].map((color) => (
                    <button key={color} type="button" aria-label={color} aria-pressed={(draft.color || scope.color) === color} style={{ "--swatch": color } as CSSProperties} onClick={() => set({ color: color === scope.color ? "" : color })} />
                  ))}
                  <input type="color" value={draft.color || scope.color} onChange={(event) => set({ color: event.target.value.toUpperCase() })} aria-label="Ngjyrë tjetër" />
                </span>
              </label>
            </div>
            <label className="lgb-check">
              <input type="checkbox" checked={draft.featured} onChange={(event) => set({ featured: event.target.checked })} />
              Shfaq në Tregu, te Ligat (deri në 3)
            </label>
          </section>
        </div>

        <aside className="lgb-aside">
          <small>Kështu e shohin lojtarët</small>
          <PublicLeagueCard
            league={preview}
            now={now}
            action={<button type="button" className="lg-btn" tabIndex={-1} aria-hidden>{fee > 0 ? `Hyr · ${fmtNum(fee)} 383C` : "Hyr falas"}</button>}
          />
          <div className="lgb-summary">
            <span><b>{scope.label}</b> · {days} ditë</span>
            <span>Hyrja <b>{fee ? `${fmtNum(fee)} 383C` : "falas"}</b> · 383 paguan <b>{prizes.map((value) => fmtNum(value)).join(" / ")}</b></span>
            <span>{draft.featured ? "Del në Tregu" : "Nuk del në Tregu"}</span>
          </div>
          <button type="button" className="lg-btn" data-wide disabled={saving !== null || uploading || preview.name.length < 3} onClick={() => void save()}>
            {saving === "save" ? "Duke ruajtur…" : editing ? "Ruaj ndryshimet" : "Krijo ligën"}
          </button>
          {editing ? (
            <button type="button" className="lg-ghost" onClick={() => { setEditing(null); setDraft(freshDraft()); }}>Anulo ndryshimin</button>
          ) : (
            <button type="button" className="lg-ghost" disabled={saving !== null} onClick={() => void createAll()}>
              {saving === "bulk" ? "Duke krijuar…" : "Krijo një ligë për çdo kategori"}
            </button>
          )}
          {message && <p className="lgb-msg" data-error={message.ok ? undefined : ""} role="status">{message.text}</p>}
        </aside>
      </div>

      {leagues.length ? (
        <div className="lgb-list">
          {leagues.map((league) => (
            <article key={league.id} className="lgb-item">
              <LeagueEmblem league={{ ...league, kind: "public" }} size={42} />
              <div style={{ minWidth: 0 }}>
                <h4>{league.name}</h4>
                <p>{scopeOf(league).label} · {formatWindow(league.starts_at, league.ends_at)} · {league.members} lojtarë · hyrja {league.entry_fee} · 383 paguan {(league.prizes ?? []).join(" / ")}</p>
              </div>
              <div className="lgb-item-actions">
                <span className="lgb-status">{status(league)}</span>
                <label className="lgb-check">
                  <input type="checkbox" checked={league.featured} disabled={saving !== null} onChange={(event) => void send("PATCH", { id: league.id, featured: event.target.checked }, league.id)} />
                  Në Tregu
                </label>
                {league.featured && (
                  <label className="lgb-check">
                    #
                    <input
                      type="number"
                      min={0}
                      max={99}
                      defaultValue={league.feature_order}
                      aria-label="Renditja në Tregu"
                      style={{ width: 64 }}
                      onBlur={(event) => Number(event.target.value) !== league.feature_order && void send("PATCH", { id: league.id, feature_order: Number(event.target.value) }, league.id)}
                    />
                  </label>
                )}
                {!league.settled_at && <button type="button" className="lg-ghost" onClick={() => edit(league)}>Ndrysho</button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>Asnjë ligë publike ende.</p>
      )}
    </section>
  );
}
