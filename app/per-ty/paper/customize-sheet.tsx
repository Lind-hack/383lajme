"use client";

// "Rregullo gazetën": the reader dresses and arranges their own paper — its
// name, its kind (or "vetë", following the reading), length, pages and boxes. Every
// change applies at once, behind the sheet, so they see their paper change as
// they tap. Saved on this device only (lib/paper-prefs.mjs).
//
// Sections reorder with up/down buttons rather than drag alone, so it works
// with a keyboard, a screen reader and a thumb alike.

import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from "lucide-react";
import { LENGTHS, moveKey, type PaperBox, type PaperPrefs } from "@/lib/paper-prefs.mjs";
import { LOOKS, lookById, type LookId } from "@/lib/paper-look.mjs";
import { describeSection } from "@/lib/per-ty-paper.mjs";
import { TITLES, defaultTitle, paperTitle } from "@/lib/reader-name.mjs";
import Sheet from "./sheet";

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
  autoLook,
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
  /** The kind the reading picks today, shown beside "Vetë, sipas leximit". */
  autoLook: LookId;
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
        <legend>Lloji i gazetës</legend>
        <p className="perty-cz-note">
          Gazeta jote ndryshon pamje sipas asaj që lexon. Mund ta lësh vetë, ose ta zgjedhësh dhe të mbetet ashtu.
        </p>
        <div className="perty-cz-looks">
          <label className="perty-cz-look" data-look={autoLook}>
            <input type="radio" name="perty-look" value="auto" checked={prefs.look === "auto"} onChange={() => set({ look: "auto" })} />
            <span className="perty-cz-look-name">Vetë, sipas leximit</span>
            <span className="perty-cz-look-note">Tani: {lookById(autoLook)?.name}</span>
          </label>
          {LOOKS.map((l) => (
            <label key={l.id} className="perty-cz-look" data-look={l.id}>
              <input type="radio" name="perty-look" value={l.id} checked={prefs.look === l.id} onChange={() => set({ look: l.id })} />
              <span className="perty-cz-look-mini">
                {l.name}
              </span>
              <span className="perty-cz-look-note">{l.about}</span>
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
