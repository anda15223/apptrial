import fetch from "node-fetch";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing ${name} env var`);
  return v.trim();
}

const BASE = "https://api.onlinepos.dk/api";

function getHeaders(): Record<string, string> {
  return {
    token: requireEnv("POS_API_TOKEN"),
    firmaid: requireEnv("POS_FIRMAID"),
    Accept: "application/json",
  };
}

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
 * Response example:
 * {"period":"...","location":[{"userid":34692,"amount":3929,"pax":"0"}]}
 * Revenue = SUM(location[].amount)
 */
function extractRevenue(apiResponse: any): number {
  if (!apiResponse) return 0;

  if (Array.isArray(apiResponse.location)) {
    return apiResponse.location.reduce((sum: number, loc: any) => {
      return sum + Number(loc?.amount || 0);
    }, 0);
  }

  return 0;
}

function toUnixSeconds(d: Date) {
  return Math.floor(d.getTime() / 1000);
}

function startOfDayUtc(dateStr: string) {
  return new Date(dateStr + "T00:00:00.000Z");
}
function endOfDayUtc(dateStr: string) {
  return new Date(dateStr + "T23:59:59.999Z");
}

/**
 * ✅ Exported: any unix range revenue
 */
export async function getRevenueByUnixRange(fromUnix: number, toUnix: number) {
  const json = await apiGet(`/getByUnixTimeSales/${fromUnix}/${toUnix}`);
  return {
    ok: true as const,
    revenue: extractRevenue(json),
    raw: json,
    fromUnix,
    toUnix,
  };
}

// ✅ Exported: TODAY revenue by date
export async function getBasicSalesByDate(dateStr: string) {
  const fromUnix = toUnixSeconds(startOfDayUtc(dateStr));
  const toUnix = toUnixSeconds(endOfDayUtc(dateStr));
  return getRevenueByUnixRange(fromUnix, toUnix);
}

// ✅ Exported: WEEK revenue (full Monday–Sunday) computed from dateStr
export async function getBasicSalesByWeek(
  _weekNumber: number,
  _weekYear: number,
  dateStr?: string
) {
  if (!dateStr) throw new Error("Missing dateStr in getBasicSalesByWeek");

  const d = startOfDayUtc(dateStr);
  const day = d.getUTCDay(); // Sun=0
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return getRevenueByUnixRange(toUnixSeconds(monday), toUnixSeconds(sunday));
}

// ✅ Exported: MONTH revenue (full month) computed from dateStr
export async function getBasicSalesByMonth(
  _month: number,
  _monthYear: number,
  dateStr?: string
) {
  if (!dateStr) throw new Error("Missing dateStr in getBasicSalesByMonth");

  const d = startOfDayUtc(dateStr);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();

  const first = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const last = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return getRevenueByUnixRange(toUnixSeconds(first), toUnixSeconds(last));
}

// ✅ Exported: YEAR revenue (full year) computed from dateStr
export async function getBasicSalesByYear(_year: number, dateStr?: string) {
  if (!dateStr) throw new Error("Missing dateStr in getBasicSalesByYear");

  const d = startOfDayUtc(dateStr);
  const year = d.getUTCFullYear();

  const first = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const last = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return getRevenueByUnixRange(toUnixSeconds(first), toUnixSeconds(last));
}
