// What a reader does to a story besides reading it: saving it, unsaving it,
// commenting on it. Each tells Për ty more than a click does, so each moves the
// story's keys (its category, people and town) in the reader's device-stored
// affinity, the same map reading fills (components/reading-affinity.tsx).
//
// The places that save or comment only know the slug, so they announce the
// action as a window event; the reading tracker on the article page knows the
// story's keys and credits them. Nothing is sent anywhere.
//
// Against a full read (FULL_WEIGHT in lib/reading-engagement.mjs, 1): saving
// says "I want this kind of story", commenting says it cared enough to answer.

export const STORY_ACTION_EVENT = "383:story-action";

export const ACTION_WEIGHTS = {
  save: 1.5,
  comment: 2,
  /** Taking a save back takes most of it away again. */
  unsave: -1,
};

/** Tell the page a reader acted on this story. Safe on the server and without a window. */
export function announceStoryAction(slug, action) {
  if (typeof window === "undefined" || typeof slug !== "string" || !(action in ACTION_WEIGHTS)) return;
  try {
    window.dispatchEvent(new CustomEvent(STORY_ACTION_EVENT, { detail: { slug, action } }));
  } catch {
    // An old browser without CustomEvent: the action simply teaches nothing.
  }
}

/** The weight an announced action is worth for this story, or 0 when it is not for it. */
export function actionWeight(detail, slug) {
  if (!detail || detail.slug !== slug) return 0;
  return ACTION_WEIGHTS[detail.action] ?? 0;
}
