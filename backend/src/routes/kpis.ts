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
 * POS API only allows max 2-day range.
 * This function automatically sums many requests to cover a long range.
 */
async function fetchPosRevenueAutoRange(fromDate: string, toDate: string) {
  if (fromDate > toDate) return { total: 0, chunks: 0 };

  let cursor = fromDate;
  let total = 0;
  let chunks = 0;

  // Move by 2 days each request (from cursor to cursor+1 day)
  while (cursor <= toDate) {
    const chunkEnd = addDaysIso(cursor, 1); // 2-day window
    const actualEnd = chunkEnd <= toDate ? chunkEnd : toDate;

    const chunk = await fetchPosRevenueMax2Days(cursor, actualEnd);
    total += chunk.total;
    chunks += 1;

    cursor = addDaysIso(actualEnd, 1);
  }

  return { total, chunks };
}

kpisRouter.get("/", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : todayIso();

    // 1) Load persisted values (used for today, labor, cogs, wolt)
    const all = await listDailyInputs();
    const result = computeKpis(all, date);

    // 2) REAL AUTOMATIC POS totals for month + year (no manual import needed)
    const monthStart = startOfMonthIso(date);
    const yearStart = startOfYearIso(date);

    const monthPos = await fetchPosRevenueAutoRange(monthStart, date);
    const yearPos = await fetchPosRevenueAutoRange(yearStart, date);

    // 3) Replace month/year revenue in result with REAL POS totals (+ Wolt still added)
    // NOTE: We don’t have Wolt integration yet, so Wolt month/year comes from saved daily_inputs.
    // We'll keep it consistent by using the same sum logic as engine for Wolt part.
    const woltMonth = all
      .filter((x) => x.date >= monthStart && x.date <= date)
      .reduce((acc, x) => acc + (Number(x.woltRevenue) || 0), 0);

    const woltYear = all
      .filter((x) => x.date >= yearStart && x.date <= date)
      .reduce((acc, x) => acc + (Number(x.woltRevenue) || 0), 0);

    return res.json({
      ...result,
      revenue: {
        ...result.revenue,
        month: monthPos.total + woltMonth,
        year: yearPos.total + woltYear,
      },
      meta: {
        posMonthChunks: monthPos.chunks,
        posYearChunks: yearPos.chunks,
      },
    });
  } catch (err: any) {
    console.error("GET /api/kpis error:", err);
    res.status(500).json({
      error: err?.message ?? "Failed to compute KPIs",
    });
  }
});
