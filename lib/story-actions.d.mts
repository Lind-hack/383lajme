export type StoryAction = "save" | "comment" | "unsave";
export declare const STORY_ACTION_EVENT: string;
export declare const ACTION_WEIGHTS: Record<StoryAction, number>;
export function announceStoryAction(slug: string, action: StoryAction): void;
export function actionWeight(detail: { slug?: string; action?: string } | null | undefined, slug: string): number;
