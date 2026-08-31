export type F1ChampionshipOutcome = {
  key: string;
  label: string;
  team: string;
  team_colour?: string | null;
  headshot_url?: string | null;
  driver_number: number;
  championship_position: number;
  championship_points: number;
};

export function championshipDecision(standings: unknown[], remainingEvents: unknown[]): {
  decided: boolean;
  winnerDriverNumber: number | null;
  maximumRemaining: number;
};
export function buildChampionshipModel(context: Record<string, unknown>, options?: { simulations?: number }): any;
export function fetchOpenF1ChampionshipContext(options?: { now?: Date; fetchImpl?: typeof fetch }): Promise<any>;
export function buildCurrentF1ChampionshipMarket(options?: { now?: Date; fetchImpl?: typeof fetch; simulations?: number }): Promise<any>;
export function buildChampionshipMarketTemplate(championship: any, options?: { now?: Date }): Record<string, unknown>;
