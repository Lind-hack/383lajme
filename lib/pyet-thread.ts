// Opening Pyet Dardanin from anywhere on the page.
//
// The navbar owns the overlay; any other surface (a "Pyet Dardanin" button on a
// feed story) asks it to open with this event, optionally with a question to
// ask straight away. Conversations themselves are not kept between openings or
// pages — what Dardani remembers is what the reader asks about, in
// lib/dardani-memory-store.ts.

export const PYET_OPEN_EVENT = "383-pyet-open";

export function openPyet(question?: string) {
  window.dispatchEvent(new CustomEvent(PYET_OPEN_EVENT, { detail: { question: question ?? "" } }));
}
