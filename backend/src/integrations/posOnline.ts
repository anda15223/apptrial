import fetch from "node-fetch";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing ${name} env var`);
  return v.trim();
}

function getFirmaId(): string {
  return requireEnv("POS_FIRMAID");
}

function getApiToken(): string {
  return requireEnv("POS_API_TOKEN");
}

function getHeaders(): Record<string, string> {
  return {
    token: getApiToken(),
    firmaid: getFirmaId(),
    Accept: "application/json",
  };
}

const BASE = "https://api.onlinepos.dk/api";

async function apiGet(path: string) {
  const url = `${BASE}${path}`;

  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders() as any,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`OnlinePOS API error ${res.status} from ${url}: ${JSON.stringify(json)}`);
  }

  return json;
}

/**
 * ✅ This is the real response format you pasted:
 * {
 *   "period": "...",
 *   "location":[{"userid":34692,"amount":3929,"pax":"0"}]
 * }
 *
 * Revenue = SUM(location[].amount)
 */
function extractRevenueNumber(apiResponse: any): number {
  if (!apiResponse) return 0;

  // Main format
  if (Array.isArray(apiResponse.location)) {
    let sum = 0;
    for (const loc of apiResponse.location) {
      const amount = Number(loc?.amount || 0);
      sum += amount;
    }
    return sum;
  }

  // fallback for safety
  if (typeof apiResponse.amount === "number") return apiResponse.amount;
  if (typeof apiResponse.total === "number") return apiResponse.total;

  return 0;
}

/**
 * Convert YYYY-MM-DD to unix timestamps (seconds) in UTC
 */
function dayUnixRange(dateStr: string) {
  const from = new Date(dateStr + "T00:00:00.000Z");
  const to = new Date(dateStr + "T23:59:59.999Z");

  const fromUnix = Math.floor(from.getTime() / 1000);
  const toUnix = Math.floor(to.getTime() / 1000);

  return { fromUnix, toUnix };
}

function weekUnixRange(dateStr: string) {
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
    fromUnix: Math.floor(monday.getTime() / 1000),
    toUnix: Math.floor(sunday.getTime() / 1000),
  };
}

function monthUnixRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-11

  const first = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const last = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return {
    fromUnix: Math.floor(first.getTime() / 1000),
    toUnix: Math.floor(last.getTime() / 1000),
  };
}

function yearUnixRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const year = d.getUTCFullYear();

  const first = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const last = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return {
    fromUnix: Math.floor(first.getTime() / 1000),
    toUnix: Math.floor(last.getTime() / 1000),
  };
}

async function getRevenueByUnix(fromUnix: number, toUnix: number) {
  const json = await apiGet(`/getByUnixTimeSales/${fromUnix}/${toUnix}`);
  const revenue = extractRevenueNumber(json);

  return {
    ok: true as const,
    revenue,
    raw: json,
    fromUnix,
    toUnix,
  };
}

// ✅ TODAY
export async function getBasicSalesByDate(dateStr: string) {
  const { fromUnix, toUnix } = dayUnixRange(dateStr);
  return getRevenueByUnix(fromUnix, toUnix);
}

// ✅ WEEK (computed from dateStr)
export async function getBasicSalesByWeek(_weekNumber: number, _weekYear: number, dateStr?: string) {
  if (!dateStr) throw new Error("Missing dateStr in getBasicSalesByWeek");
  const { fromUnix, toUnix } = weekUnixRange(dateStr);
  return getRevenueByUnix(fromUnix, toUnix);
}

// ✅ MONTH (computed from dateStr)
export async function getBasicSalesByMonth(_month: number, _monthYear: number, dateStr?: string) {
  if (!dateStr) throw new Error("Missing dateStr in getBasicSalesByMonth");
  const { fromUnix, toUnix } = monthUnixRange(dateStr);
  return getRevenueByUnix(fromUnix, toUnix);
}

// ✅ YEAR (computed from dateStr)
export async function getBasicSalesByYear(_year: number, dateStr?: string) {
  if (!dateStr) throw new Error("Missing dateStr in getBasicSalesByYear");
  const { fromUnix, toUnix } = yearUnixRange(dateStr);
  return getRevenueByUnix(fromUnix, toUnix);
}
