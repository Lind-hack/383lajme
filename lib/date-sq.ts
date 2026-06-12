// Albanian date formatting — hardcoded names, no Intl locale dependency.

const WEEKDAYS = [
  "E diel",
  "E hënë",
  "E martë",
  "E mërkurë",
  "E enjte",
  "E premte",
  "E shtunë",
] as const;

const MONTHS = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
] as const;

/** "E premte, 12 qershor 2026" */
export function formatDateSq(date: Date = new Date()): string {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "12 QERSHOR 2026" — for uppercase edition stamps. */
export function formatDateShortSq(date: Date = new Date()): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()].toUpperCase()} ${date.getFullYear()}`;
}
