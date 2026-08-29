export const TRADE_SUCCESS_SOUND_DURATION_MS = {
  football: 1_800,
  f1: 1_400,
  basketball: 820,
  champions: 3_800,
  europa: 3_500,
  conference: 3_300,
  default: 420,
};

export const TRADE_SUCCESS_SOUND_ASSET = {
  football: "/audio/tregu-success/football-crowd.wav",
  f1: "/audio/tregu-success/f1-passby.wav",
  basketball: "/audio/tregu-success/basketball-squeak.wav",
  champions: "/audio/tregu-success/champions-original-stinger.wav",
  europa: "/audio/tregu-success/europa-original-stinger.wav",
  conference: "/audio/tregu-success/conference-original-stinger.wav",
  default: "/audio/tregu-success/regular-beep.wav",
};

export function resolveTradeSuccessSoundProfile({ sportTheme, league } = {}) {
  const competition = String(league ?? "").toLowerCase();
  if (/conference|europa\.conf/.test(competition)) return "conference";
  if (/champions|\bucl\b/.test(competition)) return "champions";
  if (/europa|\buel\b/.test(competition)) return "europa";
  if (sportTheme === "f1") return "f1";
  if (sportTheme === "basketball") return "basketball";
  if (sportTheme === "football") return "football";
  return "default";
}
