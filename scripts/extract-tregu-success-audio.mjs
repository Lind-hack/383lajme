import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "audio",
  "tregu-success"
);
const FADE_SECONDS = 0.4;
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

const clips = {
  champions: {
    output: "champions-the-champions-13s-17s-v2.wav",
    start: 13,
    duration: 4,
  },
  europa: {
    output: "europa-intro-0s-5s-v2.wav",
    start: 0,
    duration: 5,
  },
  f1: {
    output: "f1-passby-2s-4s-v2.wav",
    start: 2,
    duration: 2,
  },
  football: {
    output: "football-crowd-3s-5s-v2.wav",
    start: 3,
    duration: 2,
  },
  basketball: {
    output: "basketball-swish-5s-8s-v2.wav",
    start: 5,
    duration: 3,
  },
  nations: {
    output: "nations-anthem-254s-257s-v2.wav",
    start: 254,
    duration: 3,
  },
};

function parseInputs(argv) {
  const inputs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const match = argv[index].match(/^--(champions|europa|f1|football|basketball|nations)$/);
    if (!match || !argv[index + 1]) continue;
    inputs[match[1]] = resolve(argv[index + 1]);
    index += 1;
  }
  return inputs;
}

function extract(profile, input, clip) {
  if (!existsSync(input)) throw new Error(`${profile}: source file not found: ${input}`);
  const output = join(OUTPUT_DIR, clip.output);
  const fadeStart = Math.max(0, clip.duration - FADE_SECONDS);
  const result = spawnSync(FFMPEG, [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-ss", String(clip.start),
    "-t", String(clip.duration),
    "-i", input,
    "-vn",
    "-af", `afade=t=out:st=${fadeStart}:d=${FADE_SECONDS}`,
    "-ar", "44100",
    "-ac", "2",
    "-c:a", "pcm_s16le",
    output,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${profile}: ffmpeg failed: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return output;
}

const inputs = parseInputs(process.argv.slice(2));
const requested = Object.keys(clips).filter((profile) => inputs[profile]);
if (!requested.length) {
  const usage = Object.keys(clips).map((profile) => `--${profile} <file>`).join(", ");
  throw new Error(`Nothing to extract. Pass at least one source: ${usage}`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const outputs = requested.map((profile) => extract(profile, inputs[profile], clips[profile]));

console.log(JSON.stringify({ outputs, conference: "reuses the Europa asset", fadeSeconds: FADE_SECONDS }));
