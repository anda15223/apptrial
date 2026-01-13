export type PlandayTodayData = {
  staffScheduled: number;
};

export async function getPlandayToday(): Promise<PlandayTodayData> {
  // SAFE MODE mock
  return {
    staffScheduled: 0,
  };
}
