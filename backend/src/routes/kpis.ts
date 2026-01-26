import express from "express";
import {
  getBasicSalesByDate,
  getBasicSalesByMonth,
  getBasicSalesByWeek,
  getBasicSalesByYear,
} from "../integrations/posOnline";

export const kpisRouter = express.Router();

/**
 * ✅ In-memory cache (simple + reliable)
 * This prevents hammering OnlinePOS and avoids dashboard breaking
 */
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

type KpiResponse = {
  date: string;
  revenue: {
    today: number;
    week: number;
    month: number;
    year: number;
    lastYearSameDay?: number;
  };
  meta: {
    cached: boolean;
    cacheAgeSeconds: number;
    source: "live" | "cache";
    message?: string;
  };
};

// Cache store (per date)
const cache: Record<
  string,
  {
    savedAt: number;
    data: KpiResponse;
  }
> = {};

function parseDateOrThrow(dateStr?: string) {
  if (!dateStr) throw new Error("Missing date query param. Use ?date=YYYY-MM-DD");

  const ok = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!ok) throw new Error("Invalid date format. Use YYYY-MM-DD");

  const dateObj = new Date(dateStr + "T00:00:00");
  if (isNaN(dateObj.getTime())) throw new Error("Invalid date value");

  return { dateStr, dateObj };
}

function getWeekNumberAndYear(dateObj: Date) {
  // ISO week calculation
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { weekNumber: weekNo, weekYear: d.getUTCFullYear() };
}

function getCacheAgeSeconds(savedAt: number) {
  return Math.floor((Date.now() - savedAt) / 1000);
}

kpisRouter.get("/", async (req, res) => {
  try {
    const { dateStr, dateObj } = parseDateOrThrow(req.query.date as string);

    // ✅ 1) Serve fresh cache if not expired
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

    // ✅ 2) Fetch live data from OnlinePOS
    const { weekNumber, weekYear } = getWeekNumberAndYear(dateObj);
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    const [todayResp, weekResp, monthResp, yearResp] = await Promise.all([
      getBasicSalesByDate(dateStr),
      getBasicSalesByWeek(weekNumber, weekYear),
      getBasicSalesByMonth(month, year),
      getBasicSalesByYear(year),
    ]);

    // ✅ 3) If ANY request fails → fallback to last good cached result (if exists)
    const anyFailed =
      todayResp.ok === false ||
      weekResp.ok === false ||
      monthResp.ok === false ||
      yearResp.ok === false;

    if (anyFailed) {
      if (cached) {
        const age = getCacheAgeSeconds(cached.savedAt);
        return res.json({
          ...cached.data,
          meta: {
            cached: true,
            cacheAgeSeconds: age,
            source: "cache",
            message:
              "OnlinePOS session expired or failed. Returning last known good KPI values (refresh POS cookies to restore live updates).",
          },
        });
      }

      // No cache available -> return clean error
      return res.status(502).json({
        date: dateStr,
        error: "OnlinePOS request failed and no cached KPI values exist yet.",
        message:
          "Fix by updating POS_BO_COOKIE and POS_BO_XSRF in environment variables, then retry.",
      });
    }

    // ✅ 4) Build clean live KPI response
    const todayRevenue = Number(todayResp.response?.data?.revenue || 0);
    const weekRevenue = Number(weekResp.response?.data?.revenue || 0);
    const monthRevenue = Number(monthResp.response?.data?.revenue || 0);
    const yearRevenue = Number(yearResp.response?.data?.revenue || 0);

    const liveResponse: KpiResponse = {
      date: dateStr,
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        month: monthRevenue,
        year: yearRevenue,
        lastYearSameDay: 0,
      },
      meta: {
        cached: false,
        cacheAgeSeconds: 0,
        source: "live",
      },
    };

    // ✅ 5) Save live response into cache
    cache[dateStr] = {
      savedAt: Date.now(),
      data: liveResponse,
    };

    return res.json(liveResponse);
  } catch (err: any) {
    return res.status(400).json({
      error: err?.message || "Unknown error",
    });
  }
});
