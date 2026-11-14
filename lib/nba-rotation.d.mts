export declare const NBA_TEAM_GROUPS: string[][];
export declare function nbaGroupIndexFor(kickoffIso: string): number | null;
export declare function nbaGameInRotation(game: { home?: string; away?: string; kickoff?: string }): boolean;
export declare function splitTeamName(full: string | null | undefined): { city: string; name: string };
export declare const NBA_GAMES_PER_NIGHT: number;
export declare function selectNbaGames<G extends { home?: string; away?: string; kickoff?: string }>(games: G[]): G[];
