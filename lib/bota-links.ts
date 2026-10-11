// How a Bota story links out. Shared by the server-rendered homepage block and
// the client lists on /bota-per-kosoven, so it lives in neither a "use client"
// module nor a server one: a function exported from a client module cannot be
// called while the server renders (that broke the build in bf9187e4).

import type { DailyStory } from "@/lib/tone-data";

/** A story with an Albanian reader page says so; one without opens the publisher. */
export function readLabel(story: Pick<DailyStory, "translated">) {
  return story.translated ? "Lexo në shqip" : "Lexo origjinalin";
}

/** The publisher's own page opens in a new tab; 383's reader stays in this one. */
export function linkProps(story: Pick<DailyStory, "translated">) {
  return story.translated ? {} : { target: "_blank", rel: "noopener noreferrer" };
}
