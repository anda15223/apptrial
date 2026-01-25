import fetch from "node-fetch";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

function getVenueTarget(): string {
  const raw = requireEnv("POS_FIRMAID");

  // Accept both formats:
  // POS_FIRMAID=16973
  // POS_FIRMAID=venue@16973
  if (raw.startsWith("venue@")) return raw;
  return `venue@${raw}`;
}

function getAuthHeaders() {
  const cookie = requireEnv("POS_BO_COOKIE");
  const xsrf = process.env.POS_BO_XSRF || process.env.POS_XSRF_TOKEN;

  if (!xsrf) {
    throw new Error("Missing POS_BO_XSRF env var");
  }

  return {
    cookie,
    "x-xsrf-token": xsrf,
    accept: "application/json, text/plain, */*",
    origin: "https://bo.onlinepos.dk",
    referer: "https://bo.onlinepos.dk/",
  };
}

async function callBasicSales(params: Record<string, string | number>) {
  const base = "https://rest.onlinepos.dk/reports/getBasicSales";

  const url = new URL(base);
  url.searchParams.set("target", getVenueTarget());

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: getAuthHeaders() as any,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      url: url.toString(),
      response: json,
    };
  }

  return {
    ok: true as const,
    status: res.status,
    url: url.toString(),
    response: json,
  };
}

// ✅ TODAY (date=YYYY-MM-DD)
export async function getBasicSalesByDate(date: string) {
  return callBasicSales({ date });
}

// ✅ WEEK (week_number=4&week_year=2026)
export async function getBasicSalesByWeek(weekNumber: number, weekYear: number) {
  return callBasicSales({ week_number: weekNumber, week_year: weekYear });
}

// ✅ MONTH (month=1&month_year=2026)
export async function getBasicSalesByMonth(month: number, monthYear: number) {
  return callBasicSales({ month, month_year: monthYear });
}

// ✅ YEAR (year=2026)
export async function getBasicSalesByYear(year: number) {
  return callBasicSales({ year });
}
