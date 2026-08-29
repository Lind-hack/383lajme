import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44_100;
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio", "tregu-success");
mkdirSync(root, { recursive: true });

function track(seconds) {
  const length = Math.ceil(seconds * RATE);
  return [new Float64Array(length), new Float64Array(length)];
}

function envelope(t, start, end, attack = 0.03, release = 0.18) {
  if (t < start || t >= end) return 0;
  return Math.min(1, (t - start) / attack, (end - t) / release);
}

function addTone(channels, { start = 0, end, frequency, gain = 0.2, pan = 0, type = "sine" }) {
  let phase = 0;
  const from = Math.max(0, Math.floor(start * RATE));
  const to = Math.min(channels[0].length, Math.ceil(end * RATE));
  for (let index = from; index < to; index += 1) {
    const t = index / RATE;
    const hz = typeof frequency === "function" ? frequency(t) : frequency;
    phase += (Math.PI * 2 * hz) / RATE;
    const wave = type === "square" ? Math.sign(Math.sin(phase)) : type === "saw" ? 2 * ((phase / (Math.PI * 2)) % 1) - 1 : Math.sin(phase);
    const value = wave * gain * envelope(t, start, end);
    channels[0][index] += value * Math.sqrt((1 - pan) / 2);
    channels[1][index] += value * Math.sqrt((1 + pan) / 2);
  }
}

function addNoise(channels, { start = 0, end, gain = 0.15, pan = 0, shape = () => 1, seed = 383 }) {
  let random = seed >>> 0;
  let smooth = 0;
  const from = Math.max(0, Math.floor(start * RATE));
  const to = Math.min(channels[0].length, Math.ceil(end * RATE));
  for (let index = from; index < to; index += 1) {
    random = (random * 1_664_525 + 1_013_904_223) >>> 0;
    const raw = random / 0xffffffff * 2 - 1;
    smooth = smooth * 0.82 + raw * 0.18;
    const t = index / RATE;
    const value = smooth * gain * shape(t) * envelope(t, start, end, 0.015, 0.1);
    channels[0][index] += value * Math.sqrt((1 - pan) / 2);
    channels[1][index] += value * Math.sqrt((1 + pan) / 2);
  }
}

function normalize(channels, peak = 0.78) {
  let max = 0;
  for (const channel of channels) for (const sample of channel) max = Math.max(max, Math.abs(sample));
  const scale = max ? peak / max : 1;
  for (const channel of channels) for (let index = 0; index < channel.length; index += 1) channel[index] *= scale;
}

function writeWav(name, channels) {
  normalize(channels);
  const frames = channels[0].length;
  const dataBytes = frames * 4;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22); buffer.writeUInt32LE(RATE, 24); buffer.writeUInt32LE(RATE * 4, 28);
  buffer.writeUInt16LE(4, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let index = 0; index < frames; index += 1) {
    for (let channel = 0; channel < 2; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][index]));
      buffer.writeInt16LE(Math.round(sample * 32767), offset); offset += 2;
    }
  }
  writeFileSync(join(root, name), buffer);
}

function regular() {
  const out = track(0.42);
  [523.25, 659.25, 783.99].forEach((frequency, index) => addTone(out, { start: index * 0.045, end: 0.4, frequency, gain: index ? 0.16 : 0.22, type: index === 2 ? "sine" : "saw" }));
  return out;
}

function football() {
  const out = track(1.8);
  addNoise(out, { end: 1.8, gain: 0.52, shape: (t) => 0.45 + 0.55 * Math.max(0, Math.sin(t * Math.PI * 5.1)), seed: 1908 });
  [110, 164.81, 220].forEach((frequency, index) => addTone(out, { end: 1.8, frequency: (t) => frequency * (1 + Math.sin(t * 11 + index) * 0.025), gain: 0.13 / (index + 1), type: index ? "sine" : "saw" }));
  return out;
}

function f1() {
  const out = track(1.4);
  for (let slice = 0; slice < 14; slice += 1) {
    const start = slice / 10;
    const pan = -0.95 + (slice / 13) * 1.9;
    const center = 135 + Math.sin((slice / 13) * Math.PI) * 850;
    addTone(out, { start, end: Math.min(1.4, start + 0.18), frequency: (t) => center * (1 + (t - start) * 0.4), gain: 0.23, pan, type: "saw" });
    addTone(out, { start, end: Math.min(1.4, start + 0.18), frequency: center * 2, gain: 0.075, pan, type: "square" });
  }
  return out;
}

function basketball() {
  const out = track(0.82);
  [[0, 0.34, 1450, 4800, -0.25], [0.43, 0.82, 1800, 3900, 0.28]].forEach(([start, end, from, to, pan], index) => {
    addTone(out, { start, end, frequency: (t) => from + (to - from) * Math.sin(((t - start) / (end - start)) * Math.PI), gain: 0.22, pan });
    addNoise(out, { start, end, gain: 0.2, pan, shape: (t) => 0.6 + 0.4 * Math.sin(t * 170), seed: 38 + index });
  });
  return out;
}

function choral(profile) {
  const config = {
    champions: { duration: 3.8, chords: [[146.83,220,293.66],[164.81,246.94,329.63],[196,293.66,392]] },
    europa: { duration: 3.5, chords: [[130.81,196,261.63],[146.83,220,293.66],[174.61,261.63,349.23]] },
    conference: { duration: 3.3, chords: [[123.47,185,246.94],[138.59,207.65,277.18],[155.56,233.08,311.13]] },
  }[profile];
  const out = track(config.duration);
  config.chords.forEach((chord, chordIndex) => chord.forEach((frequency, voiceIndex) => {
    const start = chordIndex * 1.02;
    addTone(out, { start, end: Math.min(config.duration, start + 1.5), frequency: (t) => frequency * (1 + Math.sin(t * 4.2 + voiceIndex) * 0.004), gain: 0.23 / (voiceIndex + 1), pan: (voiceIndex - 1) * 0.28, type: voiceIndex ? "sine" : "saw" });
  }));
  return out;
}

writeWav("regular-beep.wav", regular());
writeWav("football-crowd.wav", football());
writeWav("f1-passby.wav", f1());
writeWav("basketball-squeak.wav", basketball());
writeWav("champions-original-stinger.wav", choral("champions"));
writeWav("europa-original-stinger.wav", choral("europa"));
writeWav("conference-original-stinger.wav", choral("conference"));

console.log(`Generated 7 Tregu success cues in ${root}`);
