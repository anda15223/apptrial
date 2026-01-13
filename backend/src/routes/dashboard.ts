import { Router } from "express";

export const dashboardRouter = Router();

dashboardRouter.get("/today", async (_req, res) => {
  // SAFE MODE: always returns mock data for now
  const today = new Date().toISOString().slice(0, 10);

  res.json({
    date: today,
    revenue: { pos: 0, wolt: 0, total: 0 },
    orders: { pos: 0, wolt: 0 },
    labor: { staffScheduled: 0 },
    woltLiveOrders: []
  });
});
