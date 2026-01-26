import express from "express";
import {
  getBasicSalesByDate,
  getBasicSalesByMonth,
  getBasicSalesByYear,
  getRevenueByUnixRange,
} from "../integrations/posOnline";

export const kpisRouter = express.Router();

const CACHE_TTL_MS = 60 * 1000;

type DiffBlock = {
  current: number;
  lastYear: number;
  diff: number;
  direction: "up" | "down" | "flat";
};

type KpiResponse = {
  date: string;
  revenue: {
    today: number;

    week: number;
    weekToDate: number;

    month: number;
    monthToDate: number;

    year: number;

    // Calendar same date last year (not always relevant)
    lastYearSameDay: number;

    // ✅ SAME WEEKDAY (52 weeks ago) - correct for daily compare
    lastYearSameWeekday: number;
    lastYearSameWeekdayDate: string;

    // ✅ WEEK ALIGNED (Mon→Sun) using 52-week reference
    lastYearWeek: number;
    lastYearWeekRange: { from: string; to: string };

    // Month/year calendar compare
    lastYearMonth: number;
    lastYearYear: number;
  };

  comparisons: {
    todayVsLastYearSameDay: DiffBlock;
    todayVsLastYearSameWeekday: DiffBlock;

    weekVsLastYearWeek: DiffBlock;
    monthVsLastYearMonth: DiffBlock;
    yearVsLastYearYear: DiffBlock;
  };

  meta: {
    cached: boolean;
    cacheAgeSeconds: number;
    source: "live" | "cache";
  };
};

const cache: Record<string, { savedAt: number; data: KpiResponse }> = {};

function parseDateOrThrow(dateStr?: string) {
  if (!dateStr) throw new Error("Missing date query param. Use ?date=YYYY-MM-DD");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    throw new Error("Invalid date format. Use YYYY-MM-DD");

  const dateObj = new Date(dateStr + "T00:00:00");
  if (isNaN(dateObj.getTime())) throw new Error("Invalid date value");

  return { dateStr, dateObj };
}

function getCacheAgeSeconds(savedAt: number) {
  return Math.floor((Date.now() - savedAt) / 1000);
}

function formatYYYYMMDD(dateObj: Date) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toUnixSeconds(d: Date) {
  return Math.floor(d.getTime() / 1000);
}

/**
 * ✅ Same weekday last year (52 weeks ago)
 * Subtract 364 days so weekday matches.
 */
function sameWeekdayLastYear(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const d2 = new Date(d);
  d2.setUTCDate(d2.getUTCDate() - 364);
  return formatYYYYMMDD(d2);
}

/**
 * ✅ Full week range (Mon 00:00 -> Sun 23:59) in UTC
 */
function fullWeekUnixRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const day = d.getUTCDay(); // Sun=0
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    fromUnix: toUnixSeconds(monday),
    toUnix: toUnixSeconds(sunday),
    fromDate: formatYYYYMMDD(monday),
    toDate: formatYYYYMMDD(sunday),
  };
}

/**
 * WeekToDate = Monday 00:00 -> selected date 23:59 (UTC)
 */
function weekToDateUnixRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const day = d.getUTCDay(); // Sun=0
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const endOfSelected = new Date(dateStr + "T23:59:59.999Z");

  return {
    fromUnix: toUnixSeconds(monday),
    toUnix: toUnixSeconds(endOfSelected),
  };
}

/**
 * MonthToDate = 1st 00:00 -> selected date 23:59 (UTC)
 */
function monthToDateUnixRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();

  const first = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endOfSelected = new Date(dateStr + "T23:59:59.999Z");

  return {
    fromUnix: toUnixSeconds(first),
    toUnix: toUnixSeconds(endOfSelected),
  };
}

function makeDiff(current: number, lastYear: number): DiffBlock {
  const diff = Number(current) - Number(lastYear);
  const direction: DiffBlock["direction"] =
    diff > 0 ? "up" : diff < 0 ? "down" : "flat";

  return {
    current: Number(current),
    lastYear: Number(lastYear),
    diff: Number(diff),
    direction,
  };
}

kpisRouter.get("/", async (req, res) => {
  try {
    const { dateStr, dateObj } = parseDateOrThrow(req.query.date as string);

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

    // Calendar same date last year
    const lastYearSameDayDateObj = new Date(dateObj);
    lastYearSameDayDateObj.setFullYear(dateObj.getFullYear() - 1);
    const lastYearSameDayStr = formatYYYYMMDD(
      new Date(
        Date.UTC(
          lastYearSameDayDateObj.getUTCFullYear(),
          lastYearSameDayDateObj.getUTCMonth(),
          lastYearSameDayDateObj.getUTCDate()
        )
      )
    );

    // ✅ Same weekday last year (52 weeks ago)
    const lastYearSameWeekdayStr = sameWeekdayLastYear(dateStr);

    // ✅ Week ranges (fix for week comparison)
    const thisWeekRange = fullWeekUnixRange(dateStr);
    const lastYearWeekRange = fullWeekUnixRange(lastYearSameWeekdayStr);

    // weekToDate / monthToDate unix ranges
    const wtd = weekToDateUnixRange(dateStr);
    const mtd = monthToDateUnixRange(dateStr);

    const [
      todayResp,

      // ✅ Week totals now correct (Mon→Sun)
      weekResp,
      lastYearWeekResp,

      // Month/year totals (kept as before)
      monthResp,
      yearResp,

      lastYearSameDayResp,
      lastYearSameWeekdayResp,

      weekToDateResp,
      monthToDateResp,

      // Calendar compare for month/year
      lastYearMonthResp,
      lastYearYearResp,
    ] = await Promise.all([
      getBasicSalesByDate(dateStr),

      getRevenueByUnixRange(thisWeekRange.fromUnix, thisWeekRange.toUnix),
      getRevenueByUnixRange(lastYearWeekRange.fromUnix, lastYearWeekRange.toUnix),

      getBasicSalesByMonth(month, year, dateStr),
      getBasicSalesByYear(year, dateStr),

      getBasicSalesByDate(lastYearSameDayStr),
      getBasicSalesByDate(lastYearSameWeekdayStr),

      getRevenueByUnixRange(wtd.fromUnix, wtd.toUnix),
      getRevenueByUnixRange(mtd.fromUnix, mtd.toUnix),

      getBasicSalesByMonth(month, year - 1, lastYearSameDayStr),
      getBasicSalesByYear(year - 1, lastYearSameDayStr),
    ]);

    const today = Number(todayResp?.revenue || 0);

    const week = Number(weekResp?.revenue || 0);
    const lastYearWeek = Number(lastYearWeekResp?.revenue || 0);

    const weekToDate = Number(weekToDateResp?.revenue || 0);

    const monthVal = Number(monthResp?.revenue || 0);
    const monthToDate = Number(monthToDateResp?.revenue || 0);

    const yearVal = Number(yearResp?.revenue || 0);

    const lastYearSameDay = Number(lastYearSameDayResp?.revenue || 0);

    const lastYearSameWeekday = Number(lastYearSameWeekdayResp?.revenue || 0);

    const lastYearMonthVal = Number(lastYearMonthResp?.revenue || 0);
    const lastYearYearVal = Number(lastYearYearResp?.revenue || 0);

    const liveResponse: KpiResponse = {
      date: dateStr,
      revenue: {
        today,

        week,
        weekToDate,

        month: monthVal,
        monthToDate,

        year: yearVal,

        lastYearSameDay,

        lastYearSameWeekday,
        lastYearSameWeekdayDate: lastYearSameWeekdayStr,

        lastYearWeek,
        lastYearWeekRange: {
          from: lastYearWeekRange.fromDate,
          to: lastYearWeekRange.toDate,
        },

        lastYearMonth: lastYearMonthVal,
        lastYearYear: lastYearYearVal,
      },

      comparisons: {
        todayVsLastYearSameDay: makeDiff(today, lastYearSameDay),
        todayVsLastYearSameWeekday: makeDiff(today, lastYearSameWeekday),

        weekVsLastYearWeek: makeDiff(week, lastYearWeek),
        monthVsLastYearMonth: makeDiff(monthVal, lastYearMonthVal),
        yearVsLastYearYear: makeDiff(yearVal, lastYearYearVal),
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
    return res.status(400).json({ error: err?.message || "Unknown error" });
  }
});
