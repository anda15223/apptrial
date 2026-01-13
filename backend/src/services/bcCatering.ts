export type BcCateringTodayData = {
  // placeholder for future data
  ok: boolean;
};

export async function getBcCateringToday(): Promise<BcCateringTodayData> {
  // SAFE MODE mock
  return {
    ok: true,
  };
}
