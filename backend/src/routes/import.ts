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
 * IMPORTANT:
 * We MUST filter revenue ONLY for POS_FIRMAID (your store),
 * otherwise we import the entire koncern revenue (all locations).
 *
 * Keeps other fields unchanged (woltRevenue, laborCost, bcGroceryCost).
 */

function toUnixSeconds(dateIso: string, endOfDay: boolean): number {
  // IMPORTANT:
  // Do NOT force UTC by using "Z".
  // POS Online "daily revenue" is based on local Denmark time.
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

async function fetchPosSalesTotalForDate(date: string) {
  const token = process.env.POS_API_TOKEN;
  const firmaid = process.env.POS_FIRMAID;

  if (!token) throw new Error("Missing POS_API_TOKEN");
  if (!firmaid) throw new Error("Missing POS_FIRMAID");

  const targetFirmaId = Number(firmaid);

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

  // POS sometimes returns:
  // - { entries: [...] }
  // - [] (empty array)
  const entries = Array.isArray(data?.entries)
    ? data.entries
    : Array.isArray(data)
    ? data
    : [];

  // ✅ Filter to only this firmaid (your store)
  const filtered = entries.filter((x: any) => {
    const fid = Number(x?.entry?.firmaid);
    return Number.isFinite(fid) && fid === targetFirmaId;
  });

  const posSalesTotal = filtered.reduce((acc: number, x: any) => {
    const revenue = parseRevenue(x?.entry?.revenue);
    return acc + revenue;
  }, 0);

  return {
    date,
    from,
    to,
    url,
    posSalesTotal,
    entriesCount: filtered.length,
    targetFirmaId,
    raw: data,
  };
}

importRouter.post("/pos", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : "";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ ok: false, error: "date must be YYYY-MM-DD" });
    }

    // 1) Fetch POS total for date (filtered to POS_FIRMAID only)
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
        targetFirmaId: pos.targetFirmaId,
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
