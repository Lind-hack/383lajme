const F1_MEDIA =
  "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026";

const HEADSHOTS: Record<string, string> = {
  RUS: `${F1_MEDIA}/mercedes/georus01/2026mercedesgeorus01right.webp`,
  ANT: `${F1_MEDIA}/mercedes/andant01/2026mercedesandant01right.webp`,
  LEC: `${F1_MEDIA}/ferrari/chalec01/2026ferrarichalec01right.webp`,
  HAM: `${F1_MEDIA}/ferrari/lewham01/2026ferrarilewham01right.webp`,
  NOR: `${F1_MEDIA}/mclaren/lannor01/2026mclarenlannor01right.webp`,
  PIA: `${F1_MEDIA}/mclaren/oscpia01/2026mclarenoscpia01right.webp`,
  VER: `${F1_MEDIA}/redbullracing/maxver01/2026redbullracingmaxver01right.webp`,
  HAD: `${F1_MEDIA}/redbullracing/isahad01/2026redbullracingisahad01right.webp`,
  LAW: `${F1_MEDIA}/racingbulls/lialaw01/2026racingbullslialaw01right.webp`,
  LIN: `${F1_MEDIA}/racingbulls/arvlin01/2026racingbullsarvlin01right.webp`,
  GAS: `${F1_MEDIA}/alpine/piegas01/2026alpinepiegas01right.webp`,
  COL: `${F1_MEDIA}/alpine/fracol01/2026alpinefracol01right.webp`,
  OCO: `${F1_MEDIA}/haasf1team/estoco01/2026haasf1teamestoco01right.webp`,
  BEA: `${F1_MEDIA}/haasf1team/olibea01/2026haasf1teamolibea01right.webp`,
  HUL: `${F1_MEDIA}/audi/nichul01/2026audinichul01right.webp`,
  BOR: `${F1_MEDIA}/audi/gabbor01/2026audigabbor01right.webp`,
  SAI: `${F1_MEDIA}/williams/carsai01/2026williamscarsai01right.webp`,
  ALB: `${F1_MEDIA}/williams/alealb01/2026williamsalealb01right.webp`,
  ALO: `${F1_MEDIA}/astonmartin/feralo01/2026astonmartinferalo01right.webp`,
  STR: `${F1_MEDIA}/astonmartin/lanstr01/2026astonmartinlanstr01right.webp`,
  PER: `${F1_MEDIA}/cadillac/serper01/2026cadillacserper01right.webp`,
  BOT: `${F1_MEDIA}/cadillac/valbot01/2026cadillacvalbot01right.webp`,
};

const TEAM_COLORS: Record<string, string> = {
  mclaren: "#FF8000",
  ferrari: "#E8002D",
  mercedes: "#00A19C",
  "red bull": "#3671C6",
  "racing bulls": "#4E7CFF",
  williams: "#168BFF",
  "aston martin": "#229971",
  audi: "#B6B6B6",
  alpine: "#FF87BC",
  haas: "#8B8D91",
  cadillac: "#B8903E",
};

export function f1DriverHeadshot(driverKey: string, supplied?: string): string | undefined {
  return String(supplied ?? "").trim() || HEADSHOTS[String(driverKey ?? "").trim().toUpperCase()];
}

export function f1TeamColor(team: string, supplied?: string): string {
  const color = String(supplied ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`;
  const normalizedTeam = String(team ?? "").toLowerCase();
  return Object.entries(TEAM_COLORS).find(([name]) => normalizedTeam.includes(name))?.[1] ?? "#625A50";
}
