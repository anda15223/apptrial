import express from "express";
import { listDailyInputs } from "../db/supabaseDb";
import { computeKpis } from "../kpi/engine";
import { startOfMonthIso, startOfYearIso } from "../utils/date";

export const kpisRouter = express.Router();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toUnixSeconds(dateIso: string, endOfDay: boolean): number {
  // Do NOT force UTC with "Z" because POS is local Denmark time
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;

  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  }

  return Math.floor(d.getTime() / 1000);
}

function parseRevenue(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchPosRevenueMax2Days(fromDate: string, toDate: string) {
  const token = process.env.POS_API_TOKEN;
  const firmaid = process.env.POS_FIRMAID;

  if (!token) throw new Error("Missing POS_API_TOKEN");
  if (!firmaid) throw new Error("Missing POS_FIRMAID");

  const targetFirmaId = Number(firmaid);

  const fromUnix = toUnixSeconds(fromDate, false);
  const toUnix = toUnixSeconds(toDate, true);

  const url = `https://api.onlinepos.dk/api/koncern/getKoncernRevenue/${fromUnix}/${toUnix}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      token: token,
      firmaid: String(firmaid),
      Accept: "application/json",
    },
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`POS API failed (${r.status}): ${text || "no body"}`);
  }

  const data: any = await r.json();

  const entries = Array.isArray(data?.entries)
    ? data.entries
    : Array.isArray(data)
    ? data
    : [];

  // Filter to ONLY your store POS_FIRMAID
  const filtered = entries.filter((x: any) => {
    const fid = Number(x?.entry?.firmaid);
    return Number.isFinite(fid) && fid === targetFirmaId;
  });

  const total = filtered.reduce((acc: number, x: any) => {
    return acc + parseRevenue(x?.entry?.revenue);
  }, 0);

  return {
    total,
    entriesCount: filtered.length,
    url,
  };
}

/**
 * ✅ Run promises with concurrency limit
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const currentIndex = index;
      index += 1;

      if (currentIndex >= items.length) return;

      results[currentIndex] = await fn(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * POS API only allows max 2-day range.
 * This function automatically sums many requests to cover a long range.
 *
 * ✅ Optimized: runs POS requests concurrently (but limited) for speed.
 */
async function fetchPosRevenueAutoRange(fromDate: string, toDate: string) {
  if (fromDate > toDate) return { total: 0, chunks: 0 };

  // Build all chunk ranges first
  const ranges: Array<{ from: string; to: string }> = [];

  let cursor = fromDate;
  while (cursor <= toDate) {
    const chunkEnd = addDaysIso(cursor, 1); // 2-day window
    const actualEnd = chunkEnd <= toDate ? chunkEnd : toDate;

    ranges.push({ from: cursor, to: actualEnd });
    cursor = addDaysIso(actualEnd, 1);
  }

  // ✅ Concurrency limit (safe for POS + Render)
  const POS_CONCURRENCY = 3;

  const chunkResults = await mapWithConcurrency(ranges, POS_CONCURRENCY, (r) =>
    fetchPosRevenueMax2Days(r.from, r.to)
  );

  const total = chunkResults.reduce((acc, c) => acc + c.total, 0);

  return { total, chunks: ranges.length };
}

/**
 * ✅ Simple in-memory KPI cache (per server instance)
 */
type CachedKpi = {
  expiresAtMs: number;
  payload: any;
};

const KPI_CACHE_TTL_MS = 60_000; // 60 seconds
const kpiCache = new Map<string, CachedKpi>();

/**
 * ✅ In-flight de-duplication for KPIs (per server instance)
 */
const inFlightKpi = new Map<string, Promise<any>>();

/**
 * ✅ POS range cache to avoid re-fetching month/year ranges repeatedly
 * Key: posRange:<from>..<to>
 */
type CachedPosRange = {
  expiresAtMs: number;
  value: { total: number; chunks: number };
};

const POS_RANGE_CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const posRangeCache = new Map<string, CachedPosRange>();
const inFlightPosRange = new Map<
  string,
  Promise<{ total: number; chunks: number }>
>();

async function fetchPosRevenueAutoRangeCached(fromDate: string, toDate: string) {
  const key = `posRange:${fromDate}..${toDate}`;

  const cached = posRangeCache.get(key);
  if (cached && Date.now() < cached.expiresAtMs) {
    return cached.value;
  }

  const existing = inFlightPosRange.get(key);
  if (existing) {
    return existing;
  }

  const p = (async () => {
    const value = await fetchPosRevenueAutoRange(fromDate, toDate);
    posRangeCache.set(key, {
      expiresAtMs: Date.now() + POS_RANGE_CACHE_TTL_MS,
      value,
    });
    return value;
  })();

  inFlightPosRange.set(key, p);

  try {
    return await p;
  } finally {
    inFlightPosRange.delete(key);
  }
}

/**
 * ✅ IMPORTANT:
 * POS API returns empty [] for today until POS closes the day.
 * So we fallback to yesterday to avoid dashboard showing 0.
 */
async function getPosTodayWithFallback(date: string) {
  const today = todayIso();

  if (date !== today) {
    return {
      posToday: null as number | null,
      usedDate: null as string | null,
      source: "not-today" as const,
    };
  }

  // Try "today"
  const todayChunk = await fetchPosRevenueMax2Days(date, date);
  if (todayChunk.total > 0) {
    return {
      posToday: todayChunk.total,
      usedDate: date,
      source: "pos-today" as const,
    };
  }

  // Fallback to yesterday
  const yesterday = addDaysIso(date, -1);
  const yChunk = await fetchPosRevenueMax2Days(yesterday, yesterday);

  return {
    posToday: yChunk.total,
    usedDate: yesterday,
    source: "pos-yesterday-fallback" as const,
  };
}

kpisRouter.get("/", async (req, res) => {
  try {
    const date =
      typeof req.query.date === "string" ? req.query.date : todayIso();

    const cacheKey = `kpis:${date}`;

    // 1) ✅ Serve KPI cached payload
    const cached = kpiCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAtMs) {
      return res.json({
        ...cached.payload,
        meta: {
          ...(cached.payload?.meta ?? {}),
          cached: true,
          cacheTtlSeconds: KPI_CACHE_TTL_MS / 1000,
          inFlightWait: false,
        },
      });
    }

    // 2) ✅ Wait if KPI compute already in-flight
    const existingPromise = inFlightKpi.get(cacheKey);
    if (existingPromise) {
      const payload = await existingPromise;
      return res.json({
        ...payload,
        meta: {
          ...(payload?.meta ?? {}),
          cached: true,
          cacheTtlSeconds: KPI_CACHE_TTL_MS / 1000,
          inFlightWait: true,
        },
      });
    }

    // 3) ✅ Compute once
    const computePromise = (async () => {
      const all = await listDailyInputs();
      const result = computeKpis(all, date);

      const monthStart = startOfMonthIso(date);
      const yearStart = startOfYearIso(date);

      // ✅ Month + Year POS totals in parallel, with POS-range caching
      const [monthPos, yearPos] = await Promise.all([
        fetchPosRevenueAutoRangeCached(monthStart, date),
        fetchPosRevenueAutoRangeCached(yearStart, date),
      ]);

      // ✅ Wolt month/year from persisted values (until Wolt integration exists)
      const woltMonth = all
        .filter((x) => x.date >= monthStart && x.date <= date)
        .reduce((acc, x) => acc + (Number(x.woltRevenue) || 0), 0);

      const woltYear = all
        .filter((x) => x.date >= yearStart && x.date <= date)
        .reduce((acc, x) => acc + (Number(x.woltRevenue) || 0), 0);

      // ✅ POS Today with fallback to yesterday
      const posToday = await getPosTodayWithFallback(date);

      const payload = {
        ...result,
        revenue: {
          ...result.revenue,

          // ✅ Override "today" so dashboard never shows 0 during the day
          today:
            typeof posToday.posToday === "number"
              ? posToday.posToday + (Number(result?.wolt?.today) || 0)
              : result.revenue.today,

          month: monthPos.total + woltMonth,
          year: yearPos.total + woltYear,
        },
        meta: {
          posMonthChunks: monthPos.chunks,
          posYearChunks: yearPos.chunks,
          cached: false,
          cacheTtlSeconds: KPI_CACHE_TTL_MS / 1000,
          inFlightWait: false,
          posRangeCacheTtlSeconds: POS_RANGE_CACHE_TTL_MS / 1000,

          // ✅ Added: transparency for UI (label later)
          realPosTodaySource: posToday.source,
          realPosTodayUsedDate: posToday.usedDate,
        },
      };

      kpiCache.set(cacheKey, {
        expiresAtMs: Date.now() + KPI_CACHE_TTL_MS,
        payload,
      });

      return payload;
    })();

    inFlightKpi.set(cacheKey, computePromise);

    try {
      const payload = await computePromise;
      return res.json(payload);
    } finally {
      inFlightKpi.delete(cacheKey);
    }
  } catch (err: any) {
    console.error("GET /api/kpis error:", err);
    res.status(500).json({
      error: err?.message ?? "Failed to compute KPIs",
    });
  }
});
