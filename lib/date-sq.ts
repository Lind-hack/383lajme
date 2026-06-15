// Albanian date utilities for editorial display.

const MUAJT = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor",
];

const MUAJT_SHORT = [
  "JAN", "SHK", "MAR", "PRI", "MAJ", "QER",
  "KOR", "GUS", "SHT", "TET", "NËN", "DHJ",
];

const DITET = [
  "E Diel", "E Hënë", "E Martë", "E Mërkurë",
  "E Enjte", "E Premte", "E Shtunë",
];

/** For the "date square" stamp: { day, month3 }. */
export function dateSq(date: Date | string): { day: string; month3: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  return {
    day:    String(d.getDate()).padStart(2, "0"),
    month3: MUAJT_SHORT[d.getMonth()],
  };
}

/** Full editorial date line: "E Hënë, 15 Qershor 2026". */
export function dateLine(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${DITET[d.getDay()]}, ${d.getDate()} ${MUAJT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short date: "15 Qer 2026". */
export function dateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getDate()} ${MUAJT_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
