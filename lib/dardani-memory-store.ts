// Reading and writing Dardani's memory on this device (lib/dardani-memory.mjs).
// Every storage call is wrapped: a browser that refuses storage still gets a
// working chat, it just forgets on reload.

import { MEMORY_KEY, normalizeMemory, recordQuestion, questionKeys } from "@/lib/dardani-memory.mjs";
import { readInterests, writeInterests, recordRead } from "@/lib/interests.mjs";
import { noteQuestion } from "@/lib/reader-ledger.mjs";

export function readMemory() {
  try {
    return normalizeMemory(JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "null"));
  } catch {
    return normalizeMemory(null);
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
