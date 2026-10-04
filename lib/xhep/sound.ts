/**
 * The packs' sounds, made in the browser with Web Audio — no files to load,
 * so they play the instant the finger moves. Every sound follows a gesture
 * (browsers allow audio only then), stays quiet, and can be muted; the
 * choice is remembered on the device.
 *
 *   tick()   a crackle while the strip tears, pitch rising with progress
 *   rip()    the strip coming off
 *   whoosh() a card sliding away
 *   thump()  a stamp landing
 *   chime()  the last card, or a finished scene
 */

const KEY = "xhep.sound.v1";
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Not remembered; this visit still follows the choice through the caller's state.
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return ctx;
  } catch {
    return null;
  }
}

/** A burst of filtered noise: the material of every paper sound. */
function burst(c: AudioContext, { at = 0, dur, from, to, q = 1.2, gain }: { at?: number; dur: number; from: number; to: number; q?: number; gain: number }) {
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = q;
  band.frequency.setValueAtTime(from, t);
  band.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(band).connect(g).connect(c.destination);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

/** One crackle of the seam giving way; `progress` 0..1 raises its pitch. */
export function tick(progress: number) {
  const c = audio();
  if (!c) return;
  const f = 1800 + progress * 2600;
  burst(c, { dur: 0.035, from: f, to: f * 1.3, q: 3, gain: 0.08 + progress * 0.06 });
}

/** The strip ripping off: a rough tear of crackles, then the release. */
export function rip() {
  const c = audio();
  if (!c) return;
  for (let i = 0; i < 9; i++) {
    burst(c, { at: i * 0.028 + Math.random() * 0.01, dur: 0.05, from: 2200 + i * 260, to: 3800 + i * 200, q: 2.4, gain: 0.12 });
  }
  burst(c, { at: 0.02, dur: 0.32, from: 900, to: 5200, q: 0.7, gain: 0.16 });
}

/** A card sliding off the stack. */
export function whoosh() {
  const c = audio();
  if (!c) return;
  burst(c, { dur: 0.22, from: 600, to: 2400, q: 0.9, gain: 0.05 });
}

/** A rubber stamp landing on card. */
export function thump() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.14);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.2);
  burst(c, { dur: 0.04, from: 3000, to: 2000, q: 1, gain: 0.06 });
}

/** Three bright notes: the special card, or a finished picture. */
export function chime() {
  const c = audio();
  if (!c) return;
  [880, 1174.66, 1567.98].forEach((f, i) => {
    const t = c.currentTime + i * 0.09;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.65);
  });
}
