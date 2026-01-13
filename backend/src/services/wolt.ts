export type WoltTodayData = {
  revenue: number;
  orders: number;
  liveOrders: Array<any>;
};

export async function getWoltToday(): Promise<WoltTodayData> {
  // SAFE MODE mock
  return {
    revenue: 0,
    orders: 0,
    liveOrders: [],
  };
}
