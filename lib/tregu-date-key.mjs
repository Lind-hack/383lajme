const PRISTINA_TIME_ZONE = "Europe/Pristina";
const KOSOVO_EQUIVALENT_TIME_ZONE = "Europe/Belgrade";
const DATE_OPTIONS = { timeZone: PRISTINA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" };

function formatDateParts(now, DateTimeFormat, timeZone) {
  return new DateTimeFormat("en-CA", { ...DATE_OPTIONS, timeZone })
    .formatToParts(now)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
}

/** Returns the Kosovo calendar date, using Belgrade only when Pristina is absent from this Intl build. */
export function kosovoLocalDate(now, DateTimeFormat = Intl.DateTimeFormat) {
  let parts;
  try {
    parts = formatDateParts(now, DateTimeFormat, PRISTINA_TIME_ZONE);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    parts = formatDateParts(now, DateTimeFormat, KOSOVO_EQUIVALENT_TIME_ZONE);
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}
