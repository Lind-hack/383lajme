"use client";

// A card opened from the binder. Each kind does its own job:
//
//   place  — the card, flippable to its guide: what to do, time to spend,
//            best time, the map, and the two ways to stamp it;
//   stamps — the city's scene, stamp by stamp; tap a piece to stamp its
//            place. All seven complete the picture. The trip's QR sits in
//            the corner as a small postmark, tap to enlarge it for scanning;
//   mural  — the visitor's own photos and selfies on a wall, kept on the
//            device until they send them to 383;
//   story  — their words about the city, saved as they type.

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ImagePlus, LocateFixed, PenLine, RotateCw, Trash2, X } from "lucide-react";
import { localizedPlace } from "@/lib/xhep/places.mjs";
import { addHandStamp, PACK_ART, stampState } from "@/lib/xhep/packs.mjs";
import { readProfile } from "@/lib/xhep/profile.mjs";
import { requestGpsStamp, type GpsStampResult } from "@/lib/xhep/gps-stamp";
import { qrMatrix } from "@/lib/xhep/qr-art.mjs";
import { tripUrl } from "@/lib/xhep/trip-link.mjs";
import { addMuralPhotos, MURAL_MAX, muralPhotos, readStory, removeMuralPhoto, writeStory, type MuralPhoto, type PhotoError } from "@/lib/xhep/journal";
import { track } from "@/lib/analytics";
import type { XhepLang } from "@/lib/xhep/i18n";
import { CardFace, cityName, placePhoto, Scene, type PackCard } from "./cards";
import SendTo383, { type SendText } from "./send-to-383";
import PuzzleReward, { type RewardText } from "./puzzle-reward";
import { useXhepProfile, type XhepProfile } from "./use-profile";
import styles from "./detail.module.css";
import * as sfx from "@/lib/xhep/sound";

export type DetailText = {
  close: string;
  flipToGuide: string;
  flipToCard: string;
  whatToDo: string;
  timeToSpend: string;
  bestTime: string;
  bestTimes: Record<string, string>;
  openMap: string;
  stampGps: string;
  stampHand: string;
  stampedGold: string;
  stampedHand: string;
  stampWorking: string;
  stampErrors: { denied: string; too_far: (km: string) => string; low_accuracy: string; no_location: string; generic: string };
  stampsTitle: string;
  stampsIntro: string;
  stampsDone: (n: number, of: number) => string;
  complete: (city: string) => string;
  qrLabel: string;
  qrHint: string;
  muralTitle: string;
  muralIntro: string;
  muralAdd: string;
  muralRemove: string;
  muralCount: (n: number, max: number) => string;
  muralErrors: Record<PhotoError, string>;
  storyTitle: string;
  storyIntro: string;
  storyPlaceholder: string;
  storySaved: string;
  faces: Parameters<typeof CardFace>[0]["t"];
  send: SendText;
  reward: RewardText;
};

function Sheet({ title, onClose, accent, children, closeLabel }: { title: string; onClose: () => void; accent: string; children: React.ReactNode; closeLabel: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      style={{ "--accent": accent } as React.CSSProperties}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <h2 tabIndex={-1} autoFocus>
            {title}
          </h2>
          <button type="button" className={styles.icon} onClick={onClose} aria-label={closeLabel}>
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}

/** The two ways to stamp a place, and what happened. */
function StampButtons({ placeId, profile, t, onStamped }: { placeId: string; profile: XhepProfile | null; t: DetailText; onStamped: (id: string) => void }) {
  const { update } = useXhepProfile();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const stamp = profile ? (stampState(profile, placeId.split("-")[0]).places.find((p) => p.place.id === placeId)?.stamp ?? null) : null;

  function explain(r: Extract<GpsStampResult, { ok: false }>) {
    if (r.code === "too_far") return t.stampErrors.too_far(r.distanceM ? (r.distanceM / 1000).toFixed(1) : "?");
    if (r.code === "denied" || r.code === "low_accuracy" || r.code === "no_location") return t.stampErrors[r.code];
    return t.stampErrors.generic;
  }

  async function gps() {
    setBusy(true);
    setNote(null);
    // A visitor without a profile yet gets one (and its card seed) first.
    if (!profile?.seed) update(() => ({}));
    const result: GpsStampResult = await requestGpsStamp(placeId, readProfile()?.seed ?? "");
    setBusy(false);
    if (!result.ok) return setNote(explain(result));
    update((p) => ({ stamps: [...(p.stamps ?? []), result.stamp] }));
    try {
      navigator.vibrate?.([12, 40, 22]);
    } catch {}
    sfx.thump();
    track("xhep_stamp", { city: placeId.split("-")[0], kind: "gold" });
    onStamped(placeId);
  }

  function hand() {
    update((p) => ({ handStamps: addHandStamp(p.handStamps, placeId) }));
    try {
      navigator.vibrate?.(14);
    } catch {}
    sfx.thump();
    track("xhep_stamp", { city: placeId.split("-")[0], kind: "hand" });
    onStamped(placeId);
  }

  if (stamp === "gold") return <p className={styles.stamped} data-stamp="gold">✓ {t.stampedGold}</p>;
  return (
    <div className={styles.stampButtons}>
      <button type="button" className={styles.primary} onClick={gps} disabled={busy}>
        <LocateFixed aria-hidden="true" size={17} />
        {busy ? t.stampWorking : t.stampGps}
      </button>
      {stamp === "hand" ? (
        <p className={styles.stamped} data-stamp="hand">✓ {t.stampedHand}</p>
      ) : (
        <button type="button" className={styles.ghost} onClick={hand} disabled={busy}>
          <PenLine aria-hidden="true" size={17} />
          {t.stampHand}
        </button>
      )}
      {note && (
        <p className={styles.note} role="status">
          {note}
        </p>
      )}
    </div>
  );
}

function PlaceDetail({ card, cityId, lang, profile, t, index, total }: { card: Extract<PackCard, { kind: "place" }>; cityId: string; lang: XhepLang; profile: XhepProfile | null; t: DetailText; index: number; total: number }) {
  const [back, setBack] = useState(false);
  const local = localizedPlace(cityId, card.place, lang);
  const photo = placePhoto(cityId, card.place.name);
  const full = card.place as typeof card.place & { bestTime?: string; mapsQuery?: string };
  return (
    <div className={styles.place}>
      <div className={styles.flip} data-back={back || undefined}>
        <div className={styles.flipFront} aria-hidden={back}>
          <CardFace card={card} cityId={cityId} lang={lang} profile={profile} index={index} total={total} t={t.faces} />
        </div>
        <div className={styles.flipBack} aria-hidden={!back}>
          <h3>{card.place.name}</h3>
          <dl>
            <div>
              <dt>{t.whatToDo}</dt>
              <dd>{local.description}</dd>
            </div>
            <div>
              <dt>{t.timeToSpend}</dt>
              <dd>{local.visitHint}</dd>
            </div>
            {full.bestTime && (
              <div>
                <dt>{t.bestTime}</dt>
                <dd>{t.bestTimes[full.bestTime] ?? full.bestTime}</dd>
              </div>
            )}
          </dl>
          {photo?.credit && <small className={styles.credit}>{photo.credit}</small>}
        </div>
      </div>
      <button type="button" className={styles.ghost} onClick={() => setBack((b) => !b)}>
        <RotateCw aria-hidden="true" size={16} />
        {back ? t.flipToCard : t.flipToGuide}
      </button>
      {full.mapsQuery && (
        <a className={styles.ghost} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full.mapsQuery)}`} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" size={16} />
          {t.openMap}
        </a>
      )}
      <StampButtons placeId={card.place.id} profile={profile} t={t} onStamped={() => {}} />
    </div>
  );
}

/** The trip link as a small square QR, drawn from modules — no image to fetch. */
function QrMark({ text }: { text: string }) {
  const qr = useMemo(() => {
    try {
      return qrMatrix(text);
    } catch {
      return null;
    }
  }, [text]);
  if (!qr) return null;
  const cells: string[] = [];
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.isDark(r, c)) cells.push(`M${c + 2} ${r + 2}h1v1h-1z`);
  return (
    <svg viewBox={`0 0 ${qr.size + 4} ${qr.size + 4}`} shapeRendering="crispEdges" aria-hidden="true">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={cells.join("")} fill="#1b1410" />
    </svg>
  );
}

function StampDetail({ cityId, lang, profile, t }: { cityId: string; lang: XhepLang; profile: XhepProfile | null; t: DetailText }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [qrBig, setQrBig] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const state = stampState(profile, cityId);
  const city = cityName(cityId);
  // The moment the last place is stamped, the finished picture chimes once.
  const wasComplete = useRef(state.complete);
  const [justCompleted, setJustCompleted] = useState(false);
  const sceneWrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.complete && !wasComplete.current) {
      // The pieces ripple, the seams melt, then the seal lands (puzzle-reward.tsx).
      // Bring the picture into view first: the last stamp is pressed down in the list.
      sceneWrap.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => sfx.chime(), 700);
      setJustCompleted(true);
      try {
        navigator.vibrate?.([30, 60, 30, 60, 80]);
      } catch {}
    }
    wasComplete.current = state.complete;
  }, [state.complete]);
  const url = profile ? tripUrl(profile, lang) : null;
  return (
    <div className={styles.stamps}>
      <p className={styles.intro}>{t.stampsIntro}</p>
      <div ref={sceneWrap} className={styles.sceneWrap} style={{ "--card-w": "min(100%, 520px)" } as React.CSSProperties}>
        <div className={styles.sceneFrame} data-complete={state.complete || undefined} data-celebrate={justCompleted || undefined}>
          <Scene cityId={cityId} profile={profile} justStamped={fresh} celebrate={justCompleted} />
          {url && (
            <button type="button" className={styles.postmark} onClick={() => setQrBig(true)} aria-label={t.qrLabel}>
              <QrMark text={url} />
            </button>
          )}
        </div>
        <p className={styles.progress} aria-live="polite">
          {state.complete ? t.complete(city) : t.stampsDone(state.done, state.total)}
        </p>
      </div>
      {state.complete && <PuzzleReward cityId={cityId} city={city} justCompleted={justCompleted} t={t.reward} />}
      <ol className={styles.placeList}>
        {state.places.map(({ place, stamp }, i) => (
          <li key={place.id} data-stamp={stamp ?? undefined}>
            <button type="button" className={styles.placeRow} onClick={() => setPicked(picked === place.id ? null : place.id)} aria-expanded={picked === place.id}>
              <span className={styles.placeNo}>{stamp ? "✓" : i + 1}</span>
              <span>
                <b>{place.name}</b>
                <small>{localizedPlace(cityId, place, lang).visitHint}</small>
              </span>
            </button>
            {picked === place.id && (
              <StampButtons
                placeId={place.id}
                profile={profile}
                t={t}
                onStamped={(id) => {
                  setFresh(id);
                  setPicked(null);
                }}
              />
            )}
          </li>
        ))}
      </ol>
      {qrBig && url && (
        <div className={styles.qrBig} role="dialog" aria-label={t.qrLabel} onClick={() => setQrBig(false)}>
          <div>
            <QrMark text={url} />
            <p>{t.qrHint}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MuralDetail({ cityId, t, signedStory }: { cityId: string; t: DetailText; signedStory: string }) {
  const [photos, setPhotos] = useState<MuralPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function load() {
    const list = await muralPhotos(cityId);
    setPhotos(list);
    setUrls((old) => {
      Object.values(old).forEach((u) => URL.revokeObjectURL(u));
      return Object.fromEntries(list.map((p) => [p.id, URL.createObjectURL(p.blob)]));
    });
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const { error: why } = await addMuralPhotos(cityId, [...files]);
    if (why) setError(t.muralErrors[why]);
    await load();
    setBusy(false);
    track("xhep_mural_add", { city: cityId });
  }

  return (
    <div className={styles.mural}>
      <p className={styles.intro}>{t.muralIntro}</p>
      <div className={styles.wall} data-count={photos.length}>
        {photos.map((p, i) => (
          <figure key={p.id} style={{ "--i": i } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[p.id]} alt="" />
            <button type="button" className={styles.removePhoto} onClick={async () => { await removeMuralPhoto(p.id); await load(); }} aria-label={t.muralRemove}>
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </figure>
        ))}
        {photos.length < MURAL_MAX && (
          <button type="button" className={styles.addPhoto} onClick={() => input.current?.click()} disabled={busy}>
            <ImagePlus aria-hidden="true" size={24} />
            <span>{t.muralAdd}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { void add(e.currentTarget.files); e.currentTarget.value = ""; }} />
      <p className={styles.progress}>{t.muralCount(photos.length, MURAL_MAX)}</p>
      {error && <p className={styles.note} role="status">{error}</p>}
      <SendTo383 cityId={cityId} photos={photos} story={signedStory} t={t.send} />
    </div>
  );
}

function StoryDetail({ cityId, t, photos }: { cityId: string; t: DetailText; photos: MuralPhoto[] }) {
  const [text, setText] = useState(() => readStory(cityId).text);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (writeStory(cityId, text)) setSaved(true);
    }, 500);
    return () => window.clearTimeout(id);
  }, [cityId, text]);
  return (
    <div className={styles.story}>
      <p className={styles.intro}>{t.storyIntro}</p>
      <textarea
        className={styles.storyText}
        value={text}
        maxLength={2000}
        placeholder={t.storyPlaceholder}
        onChange={(e) => {
          setSaved(false);
          setText(e.currentTarget.value);
        }}
        rows={9}
      />
      <p className={styles.progress} aria-live="polite">
        {saved ? t.storySaved : " "} · {text.length}/2000
      </p>
      <SendTo383 cityId={cityId} photos={photos} story={text} t={t.send} />
    </div>
  );
}

export default function CardDetail({
  card,
  cityId,
  lang,
  profile,
  index,
  total,
  onClose,
  t,
}: {
  card: PackCard;
  cityId: string;
  lang: XhepLang;
  profile: XhepProfile | null;
  index: number;
  total: number;
  onClose: () => void;
  t: DetailText;
}) {
  const accent = PACK_ART[cityId as keyof typeof PACK_ART].accent;
  // The mural and story go to 383 together; each view needs the other's part.
  const [photos, setPhotos] = useState<MuralPhoto[]>([]);
  useEffect(() => {
    if (card.kind === "story") void muralPhotos(cityId).then(setPhotos);
  }, [card.kind, cityId]);

  const title =
    card.kind === "place" ? card.place.name : card.kind === "stamps" ? t.stampsTitle : card.kind === "mural" ? t.muralTitle : t.storyTitle;
  return (
    <Sheet title={title} onClose={onClose} accent={accent} closeLabel={t.close}>
      {card.kind === "place" && <PlaceDetail card={card} cityId={cityId} lang={lang} profile={profile} t={t} index={index} total={total} />}
      {card.kind === "stamps" && <StampDetail cityId={cityId} lang={lang} profile={profile} t={t} />}
      {card.kind === "mural" && <MuralDetail cityId={cityId} t={t} signedStory={readStory(cityId).text} />}
      {card.kind === "story" && <StoryDetail cityId={cityId} t={t} photos={photos} />}
    </Sheet>
  );
}

