export type PosTodayData = {
  revenue: number;
  orders: number;
};

export async function getPosToday(): Promise<PosTodayData> {
  // SAFE MODE mock
  return {
    revenue: 0,
    orders: 0,
  };
}
