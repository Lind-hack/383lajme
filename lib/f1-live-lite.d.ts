export type F1Leaderboard = { race: { status?: string; current_lap?: number; total_laps?: number }; rows: { driver_code?: string; position?: number; gap?: string; pits?: number; status?: string }[] };
export function fetchF1LiveLiteLeaderboard(): Promise<F1Leaderboard>;
