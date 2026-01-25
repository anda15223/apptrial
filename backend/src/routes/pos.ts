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
 * We call it like:
 * GET /api/pos/revenue?date=YYYY-MM-DD
 *
 * This route returns:
 * - posSalesTotal (sum of revenue ONLY for POS_FIRMAID)
 * - raw response from POS
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

posRouter.get("/revenue", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : "";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const token = process.env.POS_API_TOKEN;
    const firmaid = process.env.POS_FIRMAID;

    if (!token) {
      return res.status(500).json({ error: "Missing POS_API_TOKEN" });
    }
    if (!firmaid) {
      return res.status(500).json({ error: "Missing POS_FIRMAID" });
    }

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
      return res.status(r.status).json({
        error: "POS Online API request failed",
        status: r.status,
        body: text,
        url,
      });
    }

    const data: any = await r.json();

    // POS sometimes returns { entries: [...] } and sometimes [].
    const entries = Array.isArray(data?.entries)
      ? data.entries
      : Array.isArray(data)
      ? data
      : [];

    // ✅ FILTER to only this firmaid (your store)
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
    return res.status(500).json({ error: "POS revenue route crashed" });
  }
});
