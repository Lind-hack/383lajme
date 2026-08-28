"use client";

let tradeAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  tradeAudioContext ??= new AudioContextCtor();
  return tradeAudioContext;
}

/** Unlock Web Audio while the buy button still owns a user gesture. */
export function primeTradeSuccessSound() {
  const context = getAudioContext();
  if (!context || document.hidden || context.state !== "suspended") return;
  void context.resume().catch(() => undefined);
}

/** A short, quiet ascending confirmation chord. It never blocks the receipt. */
export async function playTradeSuccessSound() {
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
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.038, start + 0.035);
  master.gain.exponentialRampToValueAtTime(0.0001, start + 0.36);
  master.connect(context.destination);

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voice = context.createGain();
    const voiceStart = start + index * 0.045;
    oscillator.type = index === 2 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, voiceStart);
    voice.gain.setValueAtTime(index === 0 ? 0.72 : 0.52, voiceStart);
    voice.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    oscillator.connect(voice);
    voice.connect(master);
    oscillator.start(voiceStart);
    oscillator.stop(start + 0.38);
  });
}
