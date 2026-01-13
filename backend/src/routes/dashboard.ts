import { Router } from "express";
import { getPosToday } from "../services/pos";
import { getWoltToday } from "../services/wolt";
import { getPlandayToday } from "../services/planday";
import { getBcCateringToday } from "../services/bcCatering";

export const dashboardRouter = Router();

dashboardRouter.get("/today", async (_req, res) => {
  // SAFE MODE: services currently return mock data
  const today = new Date().toISOString().slice(0, 10);

  const [pos, wolt, planday] = await Promise.all([
    getPosToday(),
    getWoltToday(),
    getPlandayToday(),
    getBcCateringToday(), // called to confirm integration is wired (unused for now)
  ]);

  const revenuePos = pos.revenue;
  const revenueWolt = wolt.revenue;

  res.json({
    date: today,
    revenue: {
      pos: revenuePos,
      wolt: revenueWolt,
      total: revenuePos + revenueWolt,
    },
    orders: {
      pos: pos.orders,
      wolt: wolt.orders,
    },
    labor: {
      staffScheduled: planday.staffScheduled,
    },
    woltLiveOrders: wolt.liveOrders,
  });
});
