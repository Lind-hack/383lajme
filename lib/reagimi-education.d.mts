export const EDUCATIONAL_ROLE: string;
export const EDUCATIONAL_PUBLISHERS: Readonly<Record<string, string>>;
export interface EducationSelection { date: string; title: string; context: string; videoUrl: string; }
export interface VerifiedEducationVideo { id: string; publisher: string; channelUrl: string; originalTitle: string; embedUrl: string; }
export function educationalPublisher(authorUrl: unknown): string | null;
export function educationalVideoId(raw: unknown): string | null;
export function verifyEducationalVideo(raw: unknown, fetcher?: typeof fetch): Promise<VerifiedEducationVideo>;
export function validateEducationInput(input: unknown, todayKey: string): EducationSelection;
export function educationRow(selection: EducationSelection, verified: VerifiedEducationVideo): {
  reagimi_date: string; quote: string; speaker_name: string; speaker_role: string;
  context_line: string; article_slug: null; video_url: string;
};
