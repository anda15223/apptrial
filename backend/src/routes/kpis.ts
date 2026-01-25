import express from "express";
import {
  getBasicSalesByDate,
  getBasicSalesByMonth,
  getBasicSalesByWeek,
  getBasicSalesByYear,
} from "../integrations/posOnline";

export const kpisRouter = express.Router();

function parseDateOrThrow(d?: string): string {
  if (!d) throw new Error("Missing date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Invalid date format (YYYY-MM-DD)");
  }
  return d;
}

// ISO week number + ISO week year
function getIsoWeek(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const target = new Date(date.valueOf());

  // ISO week uses Thursday as anchor
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);

  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);

  const weekNumber =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000)
    );

  return { weekNumber, weekYear: target.getFullYear() };
}

kpisRouter.get("/", async (req, res) => {
  try {
    const date = parseDateOrThrow(String(req.query.date || ""));
    const dt = new Date(date + "T00:00:00");

    const yyyy = dt.getFullYear();
    const mm = dt.getMonth() + 1; // 1-12

    const { weekNumber, weekYear } = getIsoWeek(date);

    // ✅ TODAY (BackOffice)
    const todayResp = await getBasicSalesByDate(date);
    if (!todayResp.ok) {
      return res.status(todayResp.status).json({
        error: "POS BackOffice getBasicSales(today) failed",
        status: todayResp.status,
        url: todayResp.url,
        response: todayResp.response,
      });
    }
    const todayRevenue = Number(todayResp.response?.data?.revenue ?? 0);

    // ✅ WEEK (BackOffice)
    const weekResp = await getBasicSalesByWeek(weekNumber, weekYear);
    if (!weekResp.ok) {
      return res.status(weekResp.status).json({
        error: "POS BackOffice getBasicSales(week) failed",
        status: weekResp.status,
        url: weekResp.url,
        response: weekResp.response,
      });
    }
    const weekRevenue = Number(weekResp.response?.data?.revenue ?? 0);

    // ✅ MONTH (BackOffice)
    const monthResp = await getBasicSalesByMonth(mm, yyyy);
    if (!monthResp.ok) {
      return res.status(monthResp.status).json({
        error: "POS BackOffice getBasicSales(month) failed",
        status: monthResp.status,
        url: monthResp.url,
        response: monthResp.response,
      });
    }
    const monthRevenue = Number(monthResp.response?.data?.revenue ?? 0);

    // ✅ YEAR (BackOffice)
    const yearResp = await getBasicSalesByYear(yyyy);
    if (!yearResp.ok) {
      return res.status(yearResp.status).json({
        error: "POS BackOffice getBasicSales(year) failed",
        status: yearResp.status,
        url: yearResp.url,
        response: yearResp.response,
      });
    }
    const yearRevenue = Number(yearResp.response?.data?.revenue ?? 0);

    return res.json({
      date,
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        month: monthRevenue,
        year: yearRevenue,
        lastYearSameDay: 0,
      },
      wolt: { today: 0, byDay: [] },
      labor: { todayCost: 0, laborPctToday: null },
      cogs: { todayCost: 0, cogsPctToday: null },
      meta: {
        cached: false,
        realPosTodaySource: "pos-today-live-backoffice",
        realPosTodayUsedDate: date,
        backofficeWeek: { weekNumber, weekYear },
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown KPI error" });
  }
});
