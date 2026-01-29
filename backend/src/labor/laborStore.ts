type LaborMap = Record<string, number>;

const store: Record<number, LaborMap> = {};

export function saveLaborDay(
  departmentId: number,
  date: string,
  laborCost: number
) {
  if (!store[departmentId]) {
    store[departmentId] = {};
  }
  store[departmentId][date] = laborCost;
}

export function getLaborDay(
  departmentId: number,
  date: string
): number | null {
  return store[departmentId]?.[date] ?? null;
}
