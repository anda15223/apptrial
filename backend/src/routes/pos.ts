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
 * ✅ GET /api/pos/today-live?date=YYYY-MM-DD  (BackOffice real live sales)
 *
 * Important:
 * - Koncern endpoint returns ALL firmaids (all locations)
 * - We MUST filter only POS_FIRMAID (your store) to avoid insane totals.
 */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
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
 *
 * NOTE:
 * - If date is today, query 00:00 -> NOW to get "live" revenue (if endpoint supports it).
 * - If date is past day, query 00:00 -> 23:59.
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
    const to = date === todayIso() ? nowUnixSeconds() : toUnixSeconds(date, true);

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
      liveToNow: date === todayIso(),
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
    const toUnix =
      toDate === todayIso() ? nowUnixSeconds() : toUnixSeconds(toDate, true);

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
      liveToNow: toDate === todayIso(),
      rawSummary: safeRawSummary(data),
    });
  } catch (err: any) {
    console.error("GET /api/pos/revenue-range error:", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "POS revenue-range crashed" });
  }
});

/**
 * ✅ GET /api/pos/today-live?date=YYYY-MM-DD
 * Uses POS BackOffice endpoint (rest.onlinepos.dk) which DOES return live revenue.
 *
 * IMPORTANT:
 * This requires session cookie + XSRF token from BackOffice.
 * (We are temporarily reading these from env vars.)
 */
posRouter.get("/today-live", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : "";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const POS_BO_COOKIE = process.env.POS_BO_COOKIE;
    const POS_BO_XSRF = process.env.POS_BO_XSRF;

    if (!POS_BO_COOKIE) {
      return res.status(500).json({ error: "Missing POS_BO_COOKIE env var" });
    }
    if (!POS_BO_XSRF) {
      return res.status(500).json({ error: "Missing POS_BO_XSRF env var" });
    }

    const venue = process.env.POS_FIRMAID || "16973";

    const url = `https://rest.onlinepos.dk/reports/getBasicSales?target=venue@${venue}&date=${date}`;

    const decodedCookie = POS_BO_COOKIE.replaceAll("%3D", "=").replaceAll(
      "%2B",
      "+"
    );

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: decodedCookie,
        "x-xsrf-token": POS_BO_XSRF,
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://bo.onlinepos.dk",
        Referer: "https://bo.onlinepos.dk/",
      },
    });

    const text = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: "POS BackOffice getBasicSales failed",
        status: r.status,
        url,
        response: json,
      });
    }

    const revenue = Number(json?.data?.revenue) || 0;
    const transactionCount = Number(json?.data?.transaction_count) || 0;

    return res.json({
      ok: true,
      date,
      venue: Number(venue),
      revenue,
      transactionCount,
      raw: json,
    });
  } catch (err: any) {
    console.error("GET /api/pos/today-live error:", err);
    return res.status(500).json({
      error: err?.message ?? "POS today-live crashed",
    });
  }
});
