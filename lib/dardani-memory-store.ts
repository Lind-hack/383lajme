// Reading and writing Dardani's memory on this device (lib/dardani-memory.mjs).
// Every storage call is wrapped: a browser that refuses storage still gets a
// working chat, it just forgets on reload.

import { MEMORY_KEY, normalizeMemory, recordQuestion, recordName, questionKeys } from "@/lib/dardani-memory.mjs";
import { readInterests, writeInterests, recordRead } from "@/lib/interests.mjs";
import { noteQuestion } from "@/lib/reader-ledger.mjs";

export function readMemory() {
  try {
    return normalizeMemory(JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "null"));
  } catch {
    return normalizeMemory(null);
  }
}

/** What the reader asked Dardani to call them, if they ever said. */
export function readName(): string | null {
  return readMemory()?.name ?? null;
}

/** Keep the reader's name on this device only. */
export function rememberName(name: string) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(recordName(readMemory(), name)));
  } catch {
    // Not remembered; Dardani asks again next time.
  }
}

/** The topics the reader follows, for Dardani to chat about. */
export function readFollowedTopics(): string[] {
  try {
    return (readInterests()?.categories ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Remember a question the reader asked. Its people and cities also count as a
 * read in their "Për ty" affinity, so what they ask about rises in their feed.
 */
export function rememberQuestion(question: string) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(recordQuestion(readMemory(), question)));
  } catch {
    // Not remembered; nothing else depends on it.
  }
  // Counted for the reader's wrapped; the question itself stays in this memory.
  noteQuestion();
  const keys = questionKeys(question);
  if (keys.length > 0) {
    const current = readInterests();
    writeInterests({ ...current, affinity: recordRead(current.affinity, keys) });
  }
}
