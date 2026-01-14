export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addYears(dateIso: string, years: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function startOfWeekIso(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun ... 6=Sat
  const diff = (day + 6) % 7; // Monday-start
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function startOfMonthIso(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

export function startOfYearIso(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

export function inRange(dateIso: string, startIso: string, endIsoInclusive: string): boolean {
  return dateIso >= startIso && dateIso <= endIsoInclusive;
}
