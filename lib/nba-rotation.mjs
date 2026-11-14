/**
 * Which NBA games get a Tregu market (lib/basketball-live discoverBasketball).
 *
 * Opening a market for every game on the schedule flooded the floor: seven or
 * eight NBA games a night, for an audience that mostly follows a handful of
 * teams. The thirty teams are split into three groups of ten, each with a mix
 * of the clubs people here know (Lakers, Celtics, Warriors, Bulls, Heat…) and
 * the rest. Each night (noon to noon in Prishtina) belongs to one group in
 * turn (A, B, C, A, …), and
 * a game is opened only when a team from that day's group plays in it, and
 * never more than NBA_GAMES_PER_NIGHT games a night: a group of ten alone
 * still reaches more than half of a busy schedule. Three games a night
 * instead of eight or more, from a different ten teams each night.
 *
 * Keys are ESPN's team abbreviations (team.abbreviation on the scoreboard).
 */
export const NBA_TEAM_GROUPS = [
  ["LAL", "BOS", "DEN", "MIL", "NY", "SAC", "CHA", "MEM", "UTAH", "ORL"],
  ["GS", "MIA", "OKC", "PHI", "DAL", "ATL", "TOR", "POR", "NO", "DET"],
  ["CHI", "PHX", "MIN", "CLE", "LAC", "HOU", "IND", "SA", "BKN", "WSH"],
];

const KNOWN = new Set(NBA_TEAM_GROUPS.flat());

/**
 * The NBA night a tip-off belongs to, as a day number. A night runs noon to
 * noon in Prishtina: the slate tips off between about 18:00 and 04:30 here,
 * and splitting it at midnight counted one evening as two nights (two groups,
 * two caps). Days since 1970-01-01 of the Prishtina date twelve hours earlier.
 */
function kosovoDayNumber(iso) {
  const at = new Date(Date.parse(iso) - 12 * 3_600_000);
  if (!Number.isFinite(at.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return Math.floor(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000);
}

/** The group (0, 1 or 2) whose day it is when a game tips off. */
export function nbaGroupIndexFor(kickoffIso) {
  const day = kosovoDayNumber(kickoffIso);
  return day === null ? null : ((day % 3) + 3) % 3;
}

/**
 * Whether a game gets a market. Fails open: a kickoff that cannot be read, or
 * a team abbreviation not in the groups (ESPN renaming a franchise), keeps the
 * game, so no team can drop out of Tregu for good because of a data change.
 *
 * @param {{home?: string, away?: string, kickoff?: string}} game
 */
export function nbaGameInRotation({ home, away, kickoff }) {
  const index = nbaGroupIndexFor(kickoff);
  if (index === null) return true;
  if (!KNOWN.has(home) || !KNOWN.has(away)) return true;
  const group = NBA_TEAM_GROUPS[index];
  return group.includes(home) || group.includes(away);
}

/** Three games, six teams, a night. Five still read as a flood (2026-11-14). */
export const NBA_GAMES_PER_NIGHT = 3;

/** How many of a game's teams are in its day's group; unknown teams count. */
function groupMembers({ home, away, kickoff }) {
  const index = nbaGroupIndexFor(kickoff);
  if (index === null) return 2;
  const group = NBA_TEAM_GROUPS[index];
  return [home, away].filter((team) => !KNOWN.has(team) || group.includes(team)).length;
}

/**
 * The NBA games that get a market: in the rotation, and at most
 * NBA_GAMES_PER_NIGHT per Kosovo night, games between two of the day's teams
 * first, then the earliest tip-offs. Works on any objects carrying
 * { home, away, kickoff } (ESPN abbreviations and an ISO kickoff).
 *
 * @template {{home?: string, away?: string, kickoff?: string}} G
 * @param {G[]} games
 * @returns {G[]}
 */
export function selectNbaGames(games) {
  const nights = new Map();
  for (const game of games) {
    if (!nbaGameInRotation(game)) continue;
    const night = kosovoDayNumber(game.kickoff) ?? "unknown";
    if (!nights.has(night)) nights.set(night, []);
    nights.get(night).push(game);
  }
  return [...nights.values()].flatMap((list) =>
    list
      .map((game) => ({ game, members: groupMembers(game), at: Date.parse(game.kickoff ?? "") || 0 }))
      .sort((a, b) => b.members - a.members || a.at - b.at)
      .slice(0, NBA_GAMES_PER_NIGHT)
      .map(({ game }) => game),
  );
}

/** Two-word nicknames that would otherwise lose their first word to the city. */
const TWO_WORD_NAMES = ["Trail Blazers"];

/**
 * "New Orleans Pelicans" → { city: "New Orleans", name: "Pelicans" }: the
 * name fans use, set large, with the city beneath. Never truncates a name.
 */
export function splitTeamName(full) {
  const text = String(full ?? "").trim().replace(/\s+/g, " ");
  if (!text) return { city: "", name: "" };
  const two = TWO_WORD_NAMES.find((name) => text.endsWith(` ${name}`));
  if (two) return { city: text.slice(0, -two.length - 1), name: two };
  const at = text.lastIndexOf(" ");
  return at < 0 ? { city: "", name: text } : { city: text.slice(0, at), name: text.slice(at + 1) };
}
