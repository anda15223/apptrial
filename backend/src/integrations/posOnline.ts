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
    // ✅ MUST be exactly these header names:
    Cookie: cookie,
    "X-XSRF-TOKEN": xsrf,

    // ✅ Optional but good to mimic browser
    Accept: "application/json, text/plain, */*",
    Origin: "https://bo.onlinepos.dk",
    Referer: "https://bo.onlinepos.dk/",
    "X-Requested-With": "XMLHttpRequest",
  };
}

/**
 * ✅ OnlinePOS getBasicSales response format
 */
export type OnlinePosBasicSalesResponse = {
  message: string;
  data: {
    revenue: number;
    transaction_count: number;
    average_transaction_revenue: number;
    pax_count: number;
    average_pax_revenue: number;
    from?: string;
    to?: string;
  };
};

export type OnlinePosCallOk = {
  ok: true;
  status: number;
  url: string;
  response: OnlinePosBasicSalesResponse;
};

export type OnlinePosCallFail = {
  ok: false;
  status: number;
  url: string;
  response: any;
};

export type OnlinePosCallResult = OnlinePosCallOk | OnlinePosCallFail;

async function callBasicSales(
  params: Record<string, string | number>
): Promise<OnlinePosCallResult> {
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

  const json = (await res.json().catch(() => null)) as any;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      url: url.toString(),
      response: json,
    };
  }

  return {
    ok: true,
    status: res.status,
    url: url.toString(),
    response: json as OnlinePosBasicSalesResponse,
  };
}

// ✅ TODAY (date=YYYY-MM-DD)
export async function getBasicSalesByDate(date: string) {
  return callBasicSales({ date });
}

// ✅ WEEK (week_number=5&week_year=2026)
export async function getBasicSalesByWeek(
  weekNumber: number,
  weekYear: number
) {
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
