export const KOSOVO_TIME_ZONE = "Europe/Belgrade";

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function format(value, options) {
  const date = asDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("sq-AL", {
    timeZone: KOSOVO_TIME_ZONE,
    hourCycle: "h23",
    ...options,
  }).format(date);
}

export function formatKosovoTime(value, { seconds = false } = {}) {
  return format(value, {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
}

export function formatKosovoDate(value, { year = false } = {}) {
  const date = asDate(value);
  if (!date) return "—";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: KOSOVO_TIME_ZONE,
      day: "numeric",
      month: "numeric",
      ...(year ? { year: "numeric" } : {}),
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  const compact = `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}`;
  return year ? `${compact}.${parts.year}` : compact;
}

export function formatKosovoDateTime(value, { year = false, seconds = false } = {}) {
  const date = asDate(value);
  if (!date) return "—";
  return `${formatKosovoDate(date, { year })}, ${formatKosovoTime(date, { seconds })}`;
}
