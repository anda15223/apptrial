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
 * - posSalesTotal (sum of all entries revenue)
 * - raw response from POS
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
  // POS might return revenue as string "14764.2" or number 14764.2
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

    const entries = Array.isArray(data?.entries) ? data.entries : [];

    const posSalesTotal = entries.reduce((acc: number, x: any) => {
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
      entriesCount: entries.length,
      raw: data,
    });
  } catch (err: any) {
    console.error("GET /api/pos/revenue error:", err);
    return res.status(500).json({ error: "POS revenue route crashed" });
  }
});
