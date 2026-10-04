/**
 * The place inside a signed stamp (`<placeId>.<issued>.<hmac>`), readable in
 * the browser. Verifying the signature needs the server secret and lives in
 * lib/xhep/stamps.mjs; this only reads which place a stamp is for.
 */
import { PLACES } from "./places.mjs";

const PLACE_IDS = new Set(PLACES.map((p) => p.id));

/** The place id inside a stamp, or null for anything malformed. */
export function stampPlaceId(stamp) {
  const id = /^([a-z0-9-]{3,80})\./.exec(String(stamp))?.[1];
  return id && PLACE_IDS.has(id) ? id : null;
}
