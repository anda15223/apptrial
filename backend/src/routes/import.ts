import express from "express";
import { upsertDailyInput, listDailyInputs } from "../db/supabaseDb";

export const importRouter = express.Router();

/**
 * POST /api/import/pos?date=YYYY-MM-DD
 *
 * Fetches POS revenue for a date from POS Online API,
 * then upserts into Supabase daily_inputs:
 *   - date
 *   - totalRevenue = POS posSalesTotal
 *
 * Keeps other fields unchanged (woltRevenue, laborCost, bcGroceryCost).
 */

function toUnixSeconds(dateIso: string, endOfDay: boolean): number {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return 0;

  if (endOfDay) {
    d.setUTCHours(23, 59, 59, 0);
  }
  return Math.floor(d.getTime() / 1000);
}

function parseRevenue(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchPosSalesTotalForDate(date: string) {
  const token = process.env.POS_API_TOKEN;
  const firmaid = process.env.POS_FIRMAID;

  if (!token) throw new Error("Missing POS_API_TOKEN");
  if (!firmaid) throw new Error("Missing POS_FIRMAID");

  const from = toUnixSeconds(date, false);
  const to = toUnixSeconds(date, true);

  const url = `https://api.onlinepos.dk/api/koncern/getKoncernRevenue/${from}/${to}`;

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
    throw new Error(`POS Online API request failed (${r.status}): ${text}`);
  }

  const data: any = await r.json();
  const entries = Array.isArray(data?.entries) ? data.entries : [];

  const posSalesTotal = entries.reduce((acc: number, x: any) => {
    const revenue = parseRevenue(x?.entry?.revenue);
    return acc + revenue;
  }, 0);

  return {
    date,
    from,
    to,
    url,
    posSalesTotal,
    entriesCount: entries.length,
    raw: data,
  };
}

importRouter.post("/pos", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : "";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "date must be YYYY-MM-DD" });
    }

    // 1) Fetch POS total for date
    const pos = await fetchPosSalesTotalForDate(date);

    // 2) Get existing daily input so we keep other fields unchanged
    const all = await listDailyInputs();
    const existing = all.find((x) => x.date === date);

    // 3) Upsert ONLY totalRevenue (POS)
    const saved = await upsertDailyInput({
      date,
      totalRevenue: pos.posSalesTotal,
      woltRevenue: existing?.woltRevenue ?? 0,
      laborCost: existing?.laborCost ?? 0,
      bcGroceryCost: existing?.bcGroceryCost ?? 0,
    });

    return res.json({
      ok: true,
      date,
      imported: {
        totalRevenue: pos.posSalesTotal,
      },
      saved,
      posDebug: {
        entriesCount: pos.entriesCount,
        url: pos.url,
      },
    });
  } catch (err: any) {
    console.error("POST /api/import/pos error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Import failed",
    });
  }
});
