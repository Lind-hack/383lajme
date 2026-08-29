/**
 * Vetting an explainer before it can sit inside a dossier.
 *
 * A video is the least checkable thing on the page. A reader cannot skim it for
 * a wrong date the way they can a paragraph, and a confident narrator is more
 * persuasive than a confident sentence — so an unvetted video does more damage
 * than an unvetted line of text, not less.
 *
 * Until now it was also the only part of the dossier with no checking at all:
 * twelve ids were written into lib/topics.mjs by hand, rendered straight from
 * there, and never passed through approval, liveness or any judgement about who
 * made them. That is how "HistoryLegends", an anonymous commentary channel,
 * came to be the explainer attached to KFOR.
 *
 * Two gates here, and neither is about whether the video is any good — that
 * stays with the reviewer:
 *
 *   1. the channel is a publisher, not an individual with a microphone
 *   2. the video still exists, checked against YouTube rather than assumed
 *
 * Everything that passes is still only a candidate.
 */

/**
 * Channels whose journalism can carry a claim, by exact author name as YouTube
 * reports it. An allowlist, not a blocklist: a blocklist assumes we can name
 * every bad channel, and the whole problem is that we cannot.
 *
 * `funding` is recorded rather than used to reject. A state-funded broadcaster
 * is a real newsroom with a real stake, and on this subject in particular that
 * is something a reviewer should see stated instead of buried.
 */
export const VETTED_CHANNELS = [
  // Wires and international broadcasters.
  { name: "BBC News", tier: 1, funding: "public" },
  { name: "BBC Stories", tier: 1, funding: "public" },
  { name: "BBC Newsnight", tier: 1, funding: "public" },
  { name: "Reuters", tier: 1, funding: "commercial" },
  { name: "Associated Press", tier: 1, funding: "commercial" },
  { name: "AP Archive", tier: 1, funding: "commercial" },
  { name: "Bloomberg Television", tier: 1, funding: "commercial" },
  { name: "Channel 4 News", tier: 1, funding: "commercial" },
  { name: "Frontline by ITN", tier: 1, funding: "commercial" },
  { name: "Sky News", tier: 1, funding: "commercial" },
  { name: "The Guardian", tier: 1, funding: "commercial" },

  // European public broadcasters.
  { name: "DW News", tier: 2, funding: "public" },
  { name: "euronews", tier: 2, funding: "public" },
  { name: "France 24 English", tier: 2, funding: "public" },
  { name: "TVP WORLD", tier: 2, funding: "public" },
  { name: "RFE/RL", tier: 2, funding: "us-government" },
  { name: "Radio Free Europe/Radio Liberty", tier: 2, funding: "us-government" },

  // State-funded broadcasters with a declared stake. Allowed, and labelled.
  { name: "Al Jazeera English", tier: 3, funding: "state-funded" },
  { name: "TRT World", tier: 3, funding: "state-funded" },

  // Institutions and research bodies speaking in their own name.
  { name: "Center for Strategic & International Studies", tier: 2, funding: "think-tank" },
  { name: "NATO", tier: 2, funding: "institutional" },
  { name: "United Nations", tier: 2, funding: "institutional" },
  { name: "European Parliament", tier: 2, funding: "institutional" },
  { name: "Chatham House", tier: 2, funding: "think-tank" },

  // Regional newsrooms.
  { name: "Balkan Insight", tier: 2, funding: "nonprofit" },
  { name: "Radio Televizioni i Kosovës", tier: 2, funding: "public" },
  { name: "Klan Kosova", tier: 3, funding: "commercial" },
  { name: "Euronews Albania", tier: 3, funding: "commercial" },
];

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** The vetting record for a channel, or null when it is not a publisher. */
export function vetChannel(author) {
  const a = norm(author);
  if (!a) return null;
  return (
    VETTED_CHANNELS.find((c) => {
      const n = norm(c.name);
      // Exact, or the channel's own name plus a suffix such as "BBC News UK".
      return a === n || a.startsWith(n + " ") || a.endsWith(" " + n);
    }) ?? null
  );
}

/**
 * Ask YouTube whether the video exists and who made it.
 *
 * oEmbed answers 404 for a deleted or private video and 401 for one that has
 * disabled embedding — both of which render as a broken player, so both count
 * as dead here. Anything else, including a network failure, is reported as
 * unknown rather than guessed at: a check that cannot run must not be recorded
 * as a pass.
 */
export async function checkVideo(id, { timeoutMs = 8000 } = {}) {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const endpoint =
    "https://www.youtube.com/oembed?url=" + encodeURIComponent(url) + "&format=json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      return { id, url, alive: false, http_status: res.status, author: null, title: null, vetted: null };
    }
    const j = await res.json();
    const vetted = vetChannel(j.author_name);
    return {
      id,
      url,
      alive: true,
      http_status: 200,
      author: j.author_name ?? null,
      title: j.title ?? null,
      vetted,
    };
  } catch {
    return { id, url, alive: null, http_status: null, author: null, title: null, vetted: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether a checked video may be offered to a reviewer at all.
 *
 * Both gates, and the reason spelled out, because "rejected" with no reason is
 * how a rule stops being questioned.
 */
export function admissible(check) {
  if (!check) return { ok: false, reason: "no_check" };
  if (check.alive === false) return { ok: false, reason: "video_unavailable" };
  if (check.alive === null) return { ok: false, reason: "check_failed" };
  if (!check.vetted) return { ok: false, reason: "channel_not_vetted" };
  return { ok: true, reason: null };
}
