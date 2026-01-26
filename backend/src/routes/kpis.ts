import express from "express";
import {
  getBasicSalesByDate,
  getBasicSalesByMonth,
  getBasicSalesByWeek,
  getBasicSalesByYear,
} from "../integrations/posOnline";

export const kpisRouter = express.Router();

/**
 * ✅ Stable cache (60 seconds)
 */
const CACHE_TTL_MS = 60 * 1000;

type KpiResponse = {
  date: string;
  revenue: {
    today: number;
    week: number;
    month: number;
    year: number;
    lastYearSameDay: number;
  };
  meta: {
    cached: boolean;
    cacheAgeSeconds: number;
    source: "live" | "cache";
    message?: string;
  };
};

const cache: Record<string, { savedAt: number; data: KpiResponse }> = {};

function parseDateOrThrow(dateStr?: string) {
  if (!dateStr) throw new Error("Missing date query param. Use ?date=YYYY-MM-DD");

  const ok = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!ok) throw new Error("Invalid date format. Use YYYY-MM-DD");

  const dateObj = new Date(dateStr + "T00:00:00");
  if (isNaN(dateObj.getTime())) throw new Error("Invalid date value");

  return { dateStr, dateObj };
}

function getCacheAgeSeconds(savedAt: number) {
  return Math.floor((Date.now() - savedAt) / 1000);
}

function formatYYYYMMDD(dateObj: Date) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

kpisRouter.get("/", async (req, res) => {
  try {
    const { dateStr, dateObj } = parseDateOrThrow(req.query.date as string);

    // ✅ Serve cache if fresh
    const cached = cache[dateStr];
    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
      const age = getCacheAgeSeconds(cached.savedAt);
      return res.json({
        ...cached.data,
        meta: {
          ...cached.data.meta,
          cached: true,
          cacheAgeSeconds: age,
          source: "cache",
        },
      });
    }

    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    // ✅ Last year same day (calendar)
    const lastYearDateObj = new Date(dateObj);
    lastYearDateObj.setFullYear(dateObj.getFullYear() - 1);
    const lastYearSameDayStr = formatYYYYMMDD(lastYearDateObj);

    // ✅ IMPORTANT: pass dateStr into week/month/year
    const [todayResp, weekResp, monthResp, yearResp, lastYearSameDayResp] =
      await Promise.all([
        getBasicSalesByDate(dateStr),
        getBasicSalesByWeek(0, 0, dateStr),
        getBasicSalesByMonth(month, year, dateStr),
        getBasicSalesByYear(year, dateStr),
        getBasicSalesByDate(lastYearSameDayStr),
      ]);

    const todayRevenue = Number(todayResp?.revenue || 0);
    const weekRevenue = Number(weekResp?.revenue || 0);
    const monthRevenue = Number(monthResp?.revenue || 0);
    const yearRevenue = Number(yearResp?.revenue || 0);
    const lastYearSameDayRevenue = Number(lastYearSameDayResp?.revenue || 0);

    const liveResponse: KpiResponse = {
      date: dateStr,
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        month: monthRevenue,
        year: yearRevenue,
        lastYearSameDay: lastYearSameDayRevenue,
      },
      meta: {
        cached: false,
        cacheAgeSeconds: 0,
        source: "live",
      },
    };

    cache[dateStr] = { savedAt: Date.now(), data: liveResponse };

    return res.json(liveResponse);
  } catch (err: any) {
    return res.status(400).json({
      error: err?.message || "Unknown error",
    });
  }
});
