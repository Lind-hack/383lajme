export const TRADE_SUCCESS_SOUND_DURATION_MS = {
  football: 2_000,
  f1: 2_000,
  basketball: 3_000,
  champions: 4_000,
  europa: 5_000,
  conference: 5_000,
  default: 420,
};

export const TRADE_SUCCESS_SOUND_MAX_DURATION_MS = 5_000;
export const TRADE_SUCCESS_SOUND_FADE_OUT_MS = 400;

export const TRADE_SUCCESS_SOUND_ASSET = {
  football: "/audio/tregu-success/football-crowd-3s-5s-v2.wav",
  f1: "/audio/tregu-success/f1-passby-2s-4s-v2.wav",
  basketball: "/audio/tregu-success/basketball-swish-5s-8s-v2.wav",
  champions: "/audio/tregu-success/champions-the-champions-13s-17s-v2.wav",
  europa: "/audio/tregu-success/europa-intro-0s-5s-v2.wav",
  conference: "/audio/tregu-success/europa-intro-0s-5s-v2.wav",
  default: "/audio/tregu-success/regular-beep.wav",
};

export function resolveTradeSuccessSoundProfile({ sportTheme, league } = {}) {
  const competition = String(league ?? "").toLowerCase();
  if (/conference|europa\.conf/.test(competition)) return "conference";
  if (/champions|\bucl\b/.test(competition)) return "champions";
  if (/europa|\buel\b/.test(competition)) return "europa";
  if (/^(eng|esp|ita|ger)\.1$|premier league|la liga|serie a|bundesliga/.test(competition)) return "football";
  if (sportTheme === "f1") return "f1";
  if (sportTheme === "basketball") return "basketball";
  if (sportTheme === "football") return "football";
  return "default";
}
