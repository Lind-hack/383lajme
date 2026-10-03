export declare const SNAPSHOT_VERSION: number;
export declare const MAX_EDITION: number;
export declare const MAX_SECTIONS: number;
export declare const PER_SECTION: number;
export declare const MAX_CODE_LENGTH: number;
export declare const EXPIRES_DAYS: number;

export interface Snapshot {
  date: string;
  name: string;
  style: string;
  accent: string;
  edition: string[];
  sections: { key: string; slugs: string[] }[];
}

export function encodeSnapshot(paper: {
  date: string;
  name?: string;
  style?: string;
  accent?: string;
  edition: readonly string[];
  sections?: readonly { key: string; slugs: readonly string[] }[];
}): string;
export function decodeSnapshot(code: unknown): Snapshot | null;
export function isExpired(date: string, today: string): boolean;
