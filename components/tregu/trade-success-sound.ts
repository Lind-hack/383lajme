"use client";

import {
  TRADE_SUCCESS_SOUND_ASSET as SOUND_ASSETS,
  TRADE_SUCCESS_SOUND_DURATION_MS as SOUND_DURATIONS,
  TRADE_SUCCESS_SOUND_FADE_OUT_MS,
  TRADE_SUCCESS_SOUND_MAX_DURATION_MS,
  resolveTradeSuccessSoundProfile as resolveSoundProfile,
} from "@/lib/tregu-trade-sound.mjs";

let tradeAudioContext: AudioContext | null = null;
const decodedSounds = new Map<TradeSuccessSoundProfile, AudioBuffer>();
const loadingSounds = new Map<TradeSuccessSoundProfile, Promise<AudioBuffer | null>>();

export type TradeSuccessSoundProfile =
  | "football"
  | "f1"
  | "basketball"
  | "champions"
  | "europa"
  | "conference"
  | "default";

export const TRADE_SUCCESS_SOUND_DURATION_MS = SOUND_DURATIONS as Record<TradeSuccessSoundProfile, number>;
export const TRADE_SUCCESS_SOUND_ASSET = SOUND_ASSETS as Record<TradeSuccessSoundProfile, string>;

export function resolveTradeSuccessSoundProfile({
  sportTheme,
  league,
}: {
  sportTheme?: "football" | "f1" | "basketball";
  league?: string | null;
}): TradeSuccessSoundProfile {
  return resolveSoundProfile({ sportTheme, league }) as TradeSuccessSoundProfile;
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  tradeAudioContext ??= new AudioContextCtor();
  return tradeAudioContext;
}

/** Unlock Web Audio while the buy button still owns a user gesture. */
async function loadTradeSuccessSound(context: AudioContext, profile: TradeSuccessSoundProfile) {
  const cached = decodedSounds.get(profile);
  if (cached) return cached;
  const loading = loadingSounds.get(profile);
  if (loading) return loading;
  const request = fetch(TRADE_SUCCESS_SOUND_ASSET[profile], { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`trade_sound_${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      decodedSounds.set(profile, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => loadingSounds.delete(profile));
  loadingSounds.set(profile, request);
  return request;
}

export function primeTradeSuccessSound(profile: TradeSuccessSoundProfile = "default") {
  const context = getAudioContext();
  if (!context || document.hidden) return;
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  void loadTradeSuccessSound(context, profile);
}

/** A short, quiet ascending confirmation chord. It never blocks the receipt. */
function masterGain(context: AudioContext, start: number, peak: number, end: number) {
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(peak, start + 0.035);
  master.gain.exponentialRampToValueAtTime(0.0001, end);
  master.connect(context.destination);
  return master;
}

function noiseBuffer(context: AudioContext, seconds: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
  return buffer;
}

function playDefaultCue(context: AudioContext, start: number) {
  const end = start + 0.4;
  const master = masterGain(context, start, 0.038, end);
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voice = context.createGain();
    const voiceStart = start + index * 0.045;
    oscillator.type = index === 2 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, voiceStart);
    voice.gain.setValueAtTime(index === 0 ? 0.72 : 0.52, voiceStart);
    voice.gain.exponentialRampToValueAtTime(0.0001, end - 0.02);
    oscillator.connect(voice);
    voice.connect(master);
    oscillator.start(voiceStart);
    oscillator.stop(end);
  });
}

function playFootballCue(context: AudioContext, start: number) {
  const end = start + 1.8;
  const master = masterGain(context, start, 0.046, end);
  const crowd = context.createBufferSource();
  const crowdFilter = context.createBiquadFilter();
  const crowdGain = context.createGain();
  crowd.buffer = noiseBuffer(context, 1.82);
  crowdFilter.type = "bandpass";
  crowdFilter.frequency.setValueAtTime(760, start);
  crowdFilter.Q.setValueAtTime(0.7, start);
  crowdGain.gain.setValueAtTime(0.18, start);
  [0.08, 0.46, 0.84, 1.22].forEach((offset) => {
    crowdGain.gain.linearRampToValueAtTime(0.72, start + offset + 0.13);
    crowdGain.gain.linearRampToValueAtTime(0.22, start + offset + 0.31);
  });
  crowd.connect(crowdFilter);
  crowdFilter.connect(crowdGain);
  crowdGain.connect(master);
  crowd.start(start);
  crowd.stop(end);

  [110, 164.81, 220].forEach((frequency, index) => {
    const voice = context.createOscillator();
    const gain = context.createGain();
    voice.type = index === 0 ? "sawtooth" : "triangle";
    voice.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.14 / (index + 1), start + 0.16);
    gain.gain.linearRampToValueAtTime(0.0001, end);
    voice.connect(gain);
    gain.connect(master);
    voice.start(start);
    voice.stop(end);
  });
}

function playF1Cue(context: AudioContext, start: number) {
  const end = start + 1.4;
  const master = masterGain(context, start, 0.042, end);
  const engine = context.createOscillator();
  const harmonics = context.createOscillator();
  const filter = context.createBiquadFilter();
  const engineGain = context.createGain();
  const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
  engine.type = "sawtooth";
  harmonics.type = "square";
  engine.frequency.setValueAtTime(135, start);
  engine.frequency.exponentialRampToValueAtTime(920, start + 0.7);
  engine.frequency.exponentialRampToValueAtTime(180, end);
  harmonics.frequency.setValueAtTime(270, start);
  harmonics.frequency.exponentialRampToValueAtTime(1_840, start + 0.7);
  harmonics.frequency.exponentialRampToValueAtTime(360, end);
  filter.type = "lowpass";
  filter.Q.setValueAtTime(3.2, start);
  filter.frequency.setValueAtTime(700, start);
  filter.frequency.exponentialRampToValueAtTime(5_200, start + 0.72);
  filter.frequency.exponentialRampToValueAtTime(900, end);
  engineGain.gain.setValueAtTime(0.0001, start);
  engineGain.gain.exponentialRampToValueAtTime(0.72, start + 0.58);
  engineGain.gain.exponentialRampToValueAtTime(0.0001, end);
  engine.connect(filter);
  harmonics.connect(filter);
  filter.connect(engineGain);
  if (panner) {
    panner.pan.setValueAtTime(-0.92, start);
    panner.pan.linearRampToValueAtTime(0.92, end);
    engineGain.connect(panner);
    panner.connect(master);
  } else {
    engineGain.connect(master);
  }
  engine.start(start);
  harmonics.start(start);
  engine.stop(end);
  harmonics.stop(end);
}

function playBasketballCue(context: AudioContext, start: number) {
  const end = start + 0.82;
  const master = masterGain(context, start, 0.032, end);
  const squeak = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  squeak.buffer = noiseBuffer(context, 0.84);
  filter.type = "bandpass";
  filter.Q.setValueAtTime(11, start);
  filter.frequency.setValueAtTime(1_450, start);
  filter.frequency.exponentialRampToValueAtTime(4_800, start + 0.19);
  filter.frequency.exponentialRampToValueAtTime(1_850, start + 0.39);
  filter.frequency.exponentialRampToValueAtTime(3_700, start + 0.58);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.9, start + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.48, start + 0.47);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  squeak.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  squeak.start(start);
  squeak.stop(end);
}

function playChoralCue(context: AudioContext, start: number, profile: "champions" | "europa" | "conference") {
  const durations = { champions: 3.8, europa: 3.5, conference: 3.3 };
  const chordSets = {
    champions: [[146.83, 220, 293.66], [164.81, 246.94, 329.63], [196, 293.66, 392]],
    europa: [[130.81, 196, 261.63], [146.83, 220, 293.66], [174.61, 261.63, 349.23]],
    conference: [[123.47, 185, 246.94], [138.59, 207.65, 277.18], [155.56, 233.08, 311.13]],
  };
  const end = start + durations[profile];
  const master = masterGain(context, start, 0.032, end);
  chordSets[profile].forEach((chord, chordIndex) => {
    const chordStart = start + chordIndex * 1.02;
    chord.forEach((frequency, voiceIndex) => {
      const voice = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      voice.type = voiceIndex === 0 ? "triangle" : "sine";
      voice.frequency.setValueAtTime(frequency, chordStart);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1_250 + voiceIndex * 380, chordStart);
      gain.gain.setValueAtTime(0.0001, chordStart);
      gain.gain.exponentialRampToValueAtTime(0.34 / (voiceIndex + 1), chordStart + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(end, chordStart + 1.45));
      voice.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      voice.start(chordStart);
      voice.stop(Math.min(end, chordStart + 1.5));
    });
  });

}

/** Contextual, bounded success feedback. It never blocks the receipt. */
export async function playTradeSuccessSound(profile: TradeSuccessSoundProfile = "default") {
  const context = getAudioContext();
  if (!context || document.hidden) return;

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const start = context.currentTime + 0.015;
  const recorded = await loadTradeSuccessSound(context, profile);
  if (recorded) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    const duration = Math.min(recorded.duration, TRADE_SUCCESS_SOUND_MAX_DURATION_MS / 1_000);
    const end = start + duration;
    const fadeDuration = Math.min(duration, TRADE_SUCCESS_SOUND_FADE_OUT_MS / 1_000);
    const fadeStart = end - fadeDuration;
    source.buffer = recorded;
    source.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(1, start);
    gain.gain.setValueAtTime(1, fadeStart);
    gain.gain.linearRampToValueAtTime(0, end);
    source.start(start, 0, duration);
    source.stop(end + 0.02);
    return;
  }
  if (profile === "football") playFootballCue(context, start);
  else if (profile === "f1") playF1Cue(context, start);
  else if (profile === "basketball") playBasketballCue(context, start);
  else if (profile === "champions" || profile === "europa" || profile === "conference") playChoralCue(context, start, profile);
  else playDefaultCue(context, start);
}
