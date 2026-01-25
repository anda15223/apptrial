import express from "express";

export const posRouter = express.Router();

/**
 * POS Online Koncern Revenue endpoint:
 * GET https://api.onlinepos.dk/api/koncern/getKoncernRevenue/{from}/{to}
 *
 * Required headers:
 *  - token: POS_API_TOKEN
 *  - firmaid: POS_FIRMAID
 *
 * Routes:
 * ✅ GET /api/pos/revenue?date=YYYY-MM-DD
 * ✅ GET /api/pos/revenue-range?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Important:
 * - Koncern endpoint returns ALL firmaids (all locations)
 * - We MUST filter only POS_FIRMAID (your store) to avoid insane totals.
 * - "Today" can return empty [] until POS closes the day.
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

function safeRawSummary(raw: any) {
  const isArray = Array.isArray(raw);
  const rawType = isArray ? "array" : typeof raw;

  const rawKeys =
    raw && !isArray && typeof raw === "object" ? Object.keys(raw) : [];

  const rawPreview = isArray
    ? raw.slice(0, 2)
    : raw && typeof raw === "object"
    ? Object.fromEntries(Object.entries(raw).slice(0, 5))
    : raw;

  return { rawType, rawKeys, rawPreview };
}

async function fetchKoncernRevenue(fromUnix: number, toUnix: number) {
  const token = process.env.POS_API_TOKEN;
  const firmaid = process.env.POS_FIRMAID;

  if (!token) throw new Error("Missing POS_API_TOKEN");
  if (!firmaid) throw new Error("Missing POS_FIRMAID");

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
    throw new Error(
      `POS Online API request failed (${r.status}): ${text || "no body"}`
    );
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

  return { url, data, entries };
}

/**
 * ✅ GET /api/pos/revenue?date=YYYY-MM-DD
 * Returns revenue for that day (only POS_FIRMAID)
 */
posRouter.get("/revenue", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : "";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const firmaid = process.env.POS_FIRMAID;
    if (!firmaid) {
      return res.status(500).json({ error: "Missing POS_FIRMAID" });
    }
    const targetFirmaId = Number(firmaid);

    const from = toUnixSeconds(date, false);
    const to = toUnixSeconds(date, true);

    const { url, data, entries } = await fetchKoncernRevenue(from, to);

    // ✅ Filter to only this firmaid (your store)
    const filtered = entries.filter((x: any) => {
      const fid = Number(x?.entry?.firmaid);
      return Number.isFinite(fid) && fid === targetFirmaId;
    });

    const posSalesTotal = filtered.reduce((acc: number, x: any) => {
      const revenue = parseRevenue(x?.entry?.revenue);
      return acc + revenue;
    }, 0);

    return res.json({
      ok: true,
      date,
      from,
      to,
      url,
      posSalesTotal,
      entriesCount: filtered.length,
      targetFirmaId,
      rawSummary: safeRawSummary(data),
      raw: data,
    });
  } catch (err: any) {
    console.error("GET /api/pos/revenue error:", err);
    return res.status(500).json({ error: err?.message ?? "POS revenue crashed" });
  }
});

/**
 * ✅ GET /api/pos/revenue-range?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns revenue across a date range (only POS_FIRMAID)
 *
 * This is what we will use to calculate:
 * - Month revenue
 * - Year revenue
 */
posRouter.get("/revenue-range", async (req, res) => {
  try {
    const fromDate =
      typeof req.query.from === "string" ? req.query.from : "";
    const toDate = typeof req.query.to === "string" ? req.query.to : "";

    if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return res.status(400).json({ error: "from must be YYYY-MM-DD" });
    }
    if (!toDate || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return res.status(400).json({ error: "to must be YYYY-MM-DD" });
    }
    if (fromDate > toDate) {
      return res.status(400).json({ error: "from must be <= to" });
    }

    const firmaid = process.env.POS_FIRMAID;
    if (!firmaid) {
      return res.status(500).json({ error: "Missing POS_FIRMAID" });
    }
    const targetFirmaId = Number(firmaid);

    const fromUnix = toUnixSeconds(fromDate, false);
    const toUnix = toUnixSeconds(toDate, true);

    const { url, data, entries } = await fetchKoncernRevenue(fromUnix, toUnix);

    // ✅ Filter to only this firmaid (your store)
    const filtered = entries.filter((x: any) => {
      const fid = Number(x?.entry?.firmaid);
      return Number.isFinite(fid) && fid === targetFirmaId;
    });

    const posSalesTotal = filtered.reduce((acc: number, x: any) => {
      const revenue = parseRevenue(x?.entry?.revenue);
      return acc + revenue;
    }, 0);

    return res.json({
      ok: true,
      fromDate,
      toDate,
      fromUnix,
      toUnix,
      url,
      posSalesTotal,
      entriesCount: filtered.length,
      targetFirmaId,
      rawSummary: safeRawSummary(data),
    });
  } catch (err: any) {
    console.error("GET /api/pos/revenue-range error:", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "POS revenue-range crashed" });
  }
});
