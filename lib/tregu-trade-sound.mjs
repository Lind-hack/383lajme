export const TRADE_SUCCESS_SOUND_DURATION_MS = {
  football: 1_800,
  f1: 1_400,
  basketball: 820,
  champions: 3_800,
  europa: 3_500,
  conference: 3_300,
  default: 420,
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
