import { useEffect, useMemo, useState } from "react";
import "./App.css";

type KpisResponse = {
  date: string;
  revenue: {
    today: number;
    week: number;
    weekToDate: number;

    month: number;
    monthToDate: number;

    year: number;

    // Old calendar comparison
    lastYearSameDay: number;

    // ✅ NEW weekday comparison (best)
    lastYearSameWeekday: number;
    lastYearSameWeekdayDate: string;

    lastYearWeek: number;
    lastYearMonth: number;
    lastYearYear: number;
  };

  comparisons: {
    todayVsLastYearSameDay: {
      current: number;
      lastYear: number;
      diff: number;
      direction: "up" | "down" | "flat";
    };

    // ✅ NEW weekday comparison (best)
    todayVsLastYearSameWeekday: {
      current: number;
      lastYear: number;
      diff: number;
      direction: "up" | "down" | "flat";
    };

    weekVsLastYearWeek: {
      current: number;
      lastYear: number;
      diff: number;
      direction: "up" | "down" | "flat";
    };

    monthVsLastYearMonth: {
      current: number;
      lastYear: number;
      diff: number;
      direction: "up" | "down" | "flat";
    };

    yearVsLastYearYear: {
      current: number;
      lastYear: number;
      diff: number;
      direction: "up" | "down" | "flat";
    };
  };

  meta?: {
    cached?: boolean;
    cacheAgeSeconds?: number;
    source?: "live" | "cache";
  };
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://apptrial-c8km.onrender.com";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n);
}

function getTodayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">{title}</div>
          {subtitle ? <div className="panelSubtitle">{subtitle}</div> : null}
        </div>
      </div>
      <div className="panelBody">{children}</div>
    </div>
  );
}

function SmallNote({ text }: { text: string }) {
  return <div className="smallNote">{text}</div>;
}

function MiniPill({
  text,
  kind,
}: {
  text: string;
  kind: "green" | "red" | "neutral";
}) {
  return <span className={`miniPill miniPill-${kind}`}>{text}</span>;
}

function StatCard({
  title,
  value,
  subtitle,
  deltaValue,
  deltaKindOverride,
  deltaTextOverride,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  deltaValue?: number | null;
  deltaKindOverride?: "green" | "red" | "neutral";
  deltaTextOverride?: string;
  loading?: boolean;
}) {
  const autoDeltaKind: "green" | "red" | "neutral" =
    typeof deltaValue === "number"
      ? deltaValue > 0
        ? "green"
        : deltaValue < 0
        ? "red"
        : "neutral"
      : "neutral";

  const deltaKind = deltaKindOverride ?? autoDeltaKind;

  const defaultDeltaText =
    typeof deltaValue === "number"
      ? `${deltaValue >= 0 ? "+" : ""}${fmtMoney(deltaValue)} DKK`
      : "—";

  const deltaText = deltaTextOverride ?? defaultDeltaText;

  return (
    <div className="statCard">
      <div className="statTop">
        <div className="statTitle">{title}</div>

        {loading ? (
          <MiniPill kind="neutral" text="Loading…" />
        ) : typeof deltaValue === "number" ? (
          <MiniPill kind={deltaKind} text={deltaText} />
        ) : (
          <MiniPill kind="neutral" text="—" />
        )}
      </div>

      <div className="statValue">{value}</div>
      {subtitle ? <SmallNote text={subtitle} /> : null}
    </div>
  );
}

function MoneyValue({
  loading,
  value,
}: {
  loading: boolean;
  value: number | null | undefined;
}) {
  if (loading) return <>Loading…</>;
  if (typeof value !== "number") return <>—</>;
  return <>{fmtMoney(value)} DKK</>;
}

function directionToKind(direction?: "up" | "down" | "flat") {
  if (direction === "up") return "green";
  if (direction === "down") return "red";
  return "neutral";
}

export default function App() {
  const [date] = useState(getTodayIso());
  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const locationName = "Aarhus (Gaia)";

  async function loadKpis(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const url = `${API_BASE_URL}/api/kpis?date=${date}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) throw new Error(`KPIs error: ${res.status}`);

      const data = (await res.json()) as KpisResponse;
      setKpis(data);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch KPIs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadKpis(false);
    const t = setInterval(() => loadKpis(true), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const derived = useMemo(() => {
    const meta = kpis?.meta;
    return {
      cachedText: meta?.cached ? `cached (${meta?.cacheAgeSeconds}s)` : "live",
    };
  }, [kpis]);

  // ✅ TODAY: use same weekday comparison (best)
  const todayDiffObj = kpis?.comparisons?.todayVsLastYearSameWeekday;
  const todayLyValue = kpis?.revenue?.lastYearSameWeekday ?? 0;
  const todayLyDate = kpis?.revenue?.lastYearSameWeekdayDate ?? "";

  // WEEK
  const week = kpis?.revenue?.week ?? 0;
  const lastYearWeek = kpis?.revenue?.lastYearWeek ?? 0;
  const weekDiffObj = kpis?.comparisons?.weekVsLastYearWeek;

  // MONTH
  const month = kpis?.revenue?.month ?? 0;
  const lastYearMonth = kpis?.revenue?.lastYearMonth ?? 0;
  const monthDiffObj = kpis?.comparisons?.monthVsLastYearMonth;

  // YEAR
  const year = kpis?.revenue?.year ?? 0;
  const lastYearYear = kpis?.revenue?.lastYearYear ?? 0;
  const yearDiffObj = kpis?.comparisons?.yearVsLastYearYear;

  return (
    <div className="page">
      <div className="topHeader">
        <div className="brand">
          <div className="brandTitle">Dashboard</div>
          <div className="brandSub">
            Location: <span className="brandSubStrong">{locationName}</span>
          </div>
        </div>

        <div className="topControls">
          <div className="controlBlock">
            <div className="controlLabel">Dashboard Date</div>
            <div className="apiLine">{date}</div>
          </div>

          <div className="controlBlock">
            <div className="controlLabel">API</div>
            <div className="apiLine">
              {API_BASE_URL} (refresh 60 sec • {derived.cachedText})
              {refreshing ? " • refreshing…" : ""}
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="errorBox">Error: {error}</div> : null}
      {loading ? <div className="panel">Loading dashboard…</div> : null}

      <div className="splitLayout">
        <div className="splitSection">
          <div className="sectionTitle">Sales + Planday</div>

          <div className="topHalfGrid">
            <div className="salesCardsGrid">
              {/* ✅ Sales Today uses SAME WEEKDAY last year */}
              <StatCard
                title="Sales Today"
                value={<MoneyValue loading={loading} value={kpis?.revenue?.today} />}
                subtitle={`Same weekday last year (${todayLyDate}): ${fmtMoney(
                  todayLyValue
                )} DKK`}
                deltaValue={loading ? null : todayDiffObj?.diff ?? null}
                deltaKindOverride={
                  loading ? "neutral" : directionToKind(todayDiffObj?.direction)
                }
                deltaTextOverride={
                  loading
                    ? "Loading…"
                    : `Diff: ${todayDiffObj?.diff && todayDiffObj.diff >= 0 ? "+" : ""}${fmtMoney(
                        todayDiffObj?.diff ?? 0
                      )} DKK`
                }
                loading={loading}
              />

              {/* Sales Week */}
              <StatCard
                title="Sales Week"
                value={<MoneyValue loading={loading} value={week} />}
                subtitle={`Same week last year: ${fmtMoney(lastYearWeek)} DKK`}
                deltaValue={loading ? null : weekDiffObj?.diff ?? week - lastYearWeek}
                deltaKindOverride={
                  loading ? "neutral" : directionToKind(weekDiffObj?.direction)
                }
                deltaTextOverride={
                  loading
                    ? "Loading…"
                    : `Diff: ${weekDiffObj?.diff && weekDiffObj.diff >= 0 ? "+" : ""}${fmtMoney(
                        weekDiffObj?.diff ?? week - lastYearWeek
                      )} DKK`
                }
                loading={loading}
              />

              {/* Sales Month */}
              <StatCard
                title="Sales Month"
                value={<MoneyValue loading={loading} value={month} />}
                subtitle={`Same month last year: ${fmtMoney(lastYearMonth)} DKK`}
                deltaValue={loading ? null : monthDiffObj?.diff ?? month - lastYearMonth}
                deltaKindOverride={
                  loading ? "neutral" : directionToKind(monthDiffObj?.direction)
                }
                deltaTextOverride={
                  loading
                    ? "Loading…"
                    : `Diff: ${monthDiffObj?.diff && monthDiffObj.diff >= 0 ? "+" : ""}${fmtMoney(
                        monthDiffObj?.diff ?? month - lastYearMonth
                      )} DKK`
                }
                loading={loading}
              />

              {/* Sales Year */}
              <StatCard
                title="Sales Year"
                value={<MoneyValue loading={loading} value={year} />}
                subtitle={`Same year last year: ${fmtMoney(lastYearYear)} DKK`}
                deltaValue={loading ? null : yearDiffObj?.diff ?? year - lastYearYear}
                deltaKindOverride={
                  loading ? "neutral" : directionToKind(yearDiffObj?.direction)
                }
                deltaTextOverride={
                  loading
                    ? "Loading…"
                    : `Diff: ${yearDiffObj?.diff && yearDiffObj.diff >= 0 ? "+" : ""}${fmtMoney(
                        yearDiffObj?.diff ?? year - lastYearYear
                      )} DKK`
                }
                loading={loading}
              />
            </div>

            <Panel title="Planday (Shifts Today)" subtitle="Integration coming">
              <div className="panelNote">
                Next step: connect Planday API and show real shifts.
              </div>
            </Panel>
          </div>
        </div>

        <div className="splitSection">
          <div className="sectionTitle">Next modules</div>

          <div className="bottomHalfGrid">
            <Panel title="COGS (BC Catering + Inco)" subtitle="Integration coming">
              <div className="panelNote">
                Next step: connect your invoices + calculate COGS % of sales.
              </div>
            </Panel>

            <Panel title="Delivery Orders (Wolt)" subtitle="Integration coming">
              <div className="panelNote">
                Next step: connect Wolt revenue to compare vs POS revenue.
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <div className="footerNote">
        Now “Sales Today” is compared to the SAME WEEKDAY last year (52 weeks ago).
      </div>
    </div>
  );
}
