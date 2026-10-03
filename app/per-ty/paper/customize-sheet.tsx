"use client";

// "Rregullo gazetën": the reader dresses and arranges their own paper. Every
// change applies at once, behind the sheet, so they see their paper change as
// they tap. Saved on this device only (lib/paper-prefs.mjs).
//
// Sections reorder with up/down buttons rather than drag alone, so it works
// with a keyboard, a screen reader and a thumb alike.

import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from "lucide-react";
import { ACCENTS, LENGTHS, STYLES, moveKey, type PaperAccent, type PaperBox, type PaperPrefs, type PaperStyle } from "@/lib/paper-prefs.mjs";
import { describeSection } from "@/lib/per-ty-paper.mjs";
import { TITLES, defaultTitle, paperTitle } from "@/lib/reader-name.mjs";
import Sheet from "./sheet";

const STYLE_LABEL: Record<PaperStyle, { name: string; note: string }> = {
  klasike: { name: "Klasike", note: "Si gazetë e vërtetë" },
  moderne: { name: "Moderne", note: "E pastër, e fortë" },
  nate: { name: "Natë", note: "E errët, për mbrëmje" },
};

const ACCENT_LABEL: Record<PaperAccent, string> = {
  portokalli: "Portokalli",
  blu: "Blu",
  gjelber: "Gjelbër",
  vjollce: "Vjollcë",
  kuqe: "E kuqe",
};

const LENGTH_LABEL: Record<number, string> = { 5: "Shkurt", 7: "Normal", 10: "Gjatë" };

const BOX_LABEL: Record<PaperBox, string> = {
  brief: "Në 30 sekonda (Dardani)",
  city: "Qyteti yt: moti ose kufiri",
  numbers: "Numrat e tu: ditët, leximet, seria",
  tregu: "Tregu: pyetja e ditës",
};

export default function CustomizeSheet({
  open,
  onClose,
  prefs,
  onChange,
  keys,
  name,
  onRename,
  onAddFollows,
}: {
  open: boolean;
  onClose: () => void;
  prefs: PaperPrefs;
  onChange: (next: PaperPrefs) => void;
  /** Every followed section key, in the reader's current order. */
  keys: string[];
  name: string;
  onRename: (name: string) => void;
  onAddFollows: () => void;
}) {
  const set = (patch: Partial<PaperPrefs>) => onChange({ ...prefs, ...patch });
  const hidden = new Set(prefs.hidden);

  return (
    <Sheet open={open} onClose={onClose} title="Rregullo gazetën" titleId="perty-customize-title" className="perty-sheet--customize">
      <form
        className="perty-cz-row perty-cz-name"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("name");
          onRename(typeof value === "string" ? value : "");
        }}
      >
        <label htmlFor="perty-cz-name">Emri në gazetë</label>
        <input
          id="perty-cz-name"
          name="name"
          key={name}
          defaultValue={name}
          autoComplete="given-name"
          maxLength={24}
          placeholder="Emri yt"
          onBlur={(e) => {
            if (e.currentTarget.value !== name) onRename(e.currentTarget.value);
          }}
        />
      </form>

      <fieldset className="perty-cz-group">
        <legend>Titulli i gazetës</legend>
        <div className="perty-cz-titles">
          {TITLES.map((t) => {
            const chosen = (prefs.title || defaultTitle(name)) === t.id;
            return (
              <label key={t.id} className="perty-cz-title">
                <input type="radio" name="perty-title" value={t.id} checked={chosen} onChange={() => set({ title: t.id })} />
                <span>{paperTitle(name, t.id)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="perty-cz-group">
        <legend>Pamja</legend>
        <div className="perty-cz-styles">
          {STYLES.map((style) => (
            <label key={style} className="perty-cz-style" data-style={style}>
              <input
                type="radio"
                name="perty-style"
                value={style}
                checked={prefs.style === style}
                onChange={() => set({ style })}
              />
              <span className="perty-cz-style-mini" aria-hidden="true">
                <b>Gazeta</b>
                <i />
                <i />
              </span>
              <span className="perty-cz-style-name">{STYLE_LABEL[style].name}</span>
              <span className="perty-cz-style-note">{STYLE_LABEL[style].note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="perty-cz-group">
        <legend>Ngjyra</legend>
        <div className="perty-cz-accents">
          {ACCENTS.map((accent) => (
            <label key={accent} className="perty-cz-accent" data-accent={accent} title={ACCENT_LABEL[accent]}>
              <input
                type="radio"
                name="perty-accent"
                value={accent}
                checked={prefs.accent === accent}
                onChange={() => set({ accent })}
                aria-label={ACCENT_LABEL[accent]}
              />
              <span aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="perty-cz-group">
        <legend>Sa lajme në krye</legend>
        <div className="perty-cz-seg">
          {LENGTHS.map((length) => (
            <label key={length}>
              <input
                type="radio"
                name="perty-length"
                value={length}
                checked={prefs.length === length}
                onChange={() => set({ length })}
              />
              <span>
                {LENGTH_LABEL[length]} <small>{length}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="perty-cz-group">
        <legend>Faqet e tua</legend>
        {keys.length === 0 ? (
          <p className="perty-cz-note">Ende s&apos;ndjek asgjë. Shto tema, njerëz ose qytete dhe secili merr faqen e vet.</p>
        ) : (
          <ul className="perty-cz-sections">
            {keys.map((key, i) => {
              const about = describeSection(key);
              if (!about) return null;
              const shown = !hidden.has(key);
              return (
                <li key={key} data-hidden={!shown || undefined}>
                  <span className="perty-cz-sec-title">{about.title}</span>
                  <button
                    type="button"
                    className="perty-cz-icon"
                    disabled={i === 0}
                    onClick={() => set({ order: moveKey(keys, key, -1) })}
                    aria-label={`Ngrije ${about.title} lart`}
                  >
                    <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="perty-cz-icon"
                    disabled={i === keys.length - 1}
                    onClick={() => set({ order: moveKey(keys, key, 1) })}
                    aria-label={`Ule ${about.title} poshtë`}
                  >
                    <ArrowDown size={16} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="perty-cz-icon perty-cz-eye"
                    aria-pressed={shown}
                    onClick={() =>
                      set({ hidden: shown ? [...prefs.hidden, key] : prefs.hidden.filter((k) => k !== key) })
                    }
                    aria-label={shown ? `Fshihe ${about.title}` : `Shfaqe ${about.title}`}
                  >
                    {shown ? (
                      <Eye size={16} strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <EyeOff size={16} strokeWidth={2.5} aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="perty-btn perty-btn--ghost perty-cz-add" onClick={onAddFollows}>
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          Shto tema, njerëz ose qytete
        </button>
      </fieldset>

      <fieldset className="perty-cz-group">
        <legend>Kutitë</legend>
        <ul className="perty-cz-boxes">
          {(Object.keys(BOX_LABEL) as PaperBox[]).map((box) => (
            <li key={box}>
              <label className="perty-cz-switch">
                <span>{BOX_LABEL[box]}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={prefs.boxes[box]}
                  onChange={(e) => set({ boxes: { ...prefs.boxes, [box]: e.currentTarget.checked } })}
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <button type="button" className="perty-btn perty-btn--primary perty-sheet-done" onClick={onClose}>
        Gati
      </button>
    </Sheet>
  );
}
