const TYPE_BY_KIND = {
  police: "police",
  hospital: "hospital",
  fire_station: "fire_station",
  fuel: "gas_station",
};

export function normalizePlaceName(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sq")
    .replace(/\b(shpk|sh\.p\.k|llc|kosove|kosoves|kosovo|stacioni|station)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namesDescribeSamePlace(left, right) {
  const a = normalizePlaceName(left);
  const b = normalizePlaceName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 2));
  const bTokens = new Set(b.split(" ").filter((token) => token.length > 2));
  if (!aTokens.size || !bTokens.size) return false;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  return intersection / Math.max(aTokens.size, bTokens.size) >= 0.8;
}

export function googleTypeForKind(kind) {
  return TYPE_BY_KIND[kind] ?? null;
}

export function selectExactGoogleCandidate(place, candidates, distanceKm) {
  return candidates.find((candidate) => {
    const location = candidate?.location;
    const displayName = candidate?.displayName?.text;
    if (!location || !displayName || !candidate.photos?.length) return false;
    const distance = distanceKm(place, {
      latitude: location.latitude,
      longitude: location.longitude,
    });
    return distance <= 0.15 && namesDescribeSamePlace(place.name, displayName);
  }) ?? null;
}

export function exactOsmImageReference(tags = {}) {
  const value = tags.wikimedia_commons || tags.image;
  if (!value) return null;
  if (/^File:/i.test(value)) return value.replace(/^file:/i, "File:");
  if (/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(value)) {
    return decodeURIComponent(value.split("/wiki/")[1]).replace(/_/g, " ");
  }
  return null;
}
