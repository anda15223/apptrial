import { useEffect, useMemo, useState } from "react";
import "./App.css";

type KpisResponse = {
  date: string;
  revenue: {
    today: number;
    week: number;
    month: number;
    year: number;
    lastYearSameDay: number;
  };
  wolt: {
    today: number;
    byDay: { date: string; revenue: number }[];
  };
  labor: {
    todayCost: number;
    laborPctToday: number | null;
  };
  cogs: {
    todayCost: number;
    cogsPctToday: number | null;
  };
  meta?: {
    cached?: boolean;
    cacheTtlSeconds?: number;
    inFlightWait?: boolean;
    posMonthChunks?: number;
    posYearChunks?: number;
    posRangeCacheTtlSeconds?: number;

    realPosTodaySource?: string;
    realPosTodayUsedDate?: string | null;
  };
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://apptrial.onrender.com";

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
}: {
  title: string;
  value: string;
  subtitle?: string;
  deltaValue?: number | null;
}) {
  const deltaKind =
    typeof deltaValue === "number"
      ? deltaValue >= 0
        ? "green"
        : "red"
      : "neutral";

  return (
    <div className="statCard">
      <div className="statTop">
        <div className="statTitle">{title}</div>
        {typeof deltaValue === "number" ? (
          <MiniPill
            kind={deltaKind}
            text={`${deltaValue >= 0 ? "+" : ""}${fmtMoney(deltaValue)} DKK`}
          />
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
  if (loading) return <>—</>;
  if (typeof value !== "number") return <>—</>;
  return <>{fmtMoney(value)} DKK</>;
}

export default function App() {
  const [date] = useState(getTodayIso()); // ✅ not editable anymore
  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const locationName = "Aarhus (Gaia)";

  async function loadKpis() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/kpis?date=${date}`);
      if (!res.ok) throw new Error(`KPIs error: ${res.status}`);
      const data = (await res.json()) as KpisResponse;
      setKpis(data);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch KPIs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKpis();
    const t = setInterval(loadKpis, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const derived = useMemo(() => {
    const meta = kpis?.meta;

    const isFallback =
      meta?.realPosTodaySource === "pos-yesterday-fallback" &&
      Boolean(meta?.realPosTodayUsedDate);

    const isLive =
      meta?.realPosTodaySource === "pos-today-live-backoffice" &&
      meta?.realPosTodayUsedDate === date;

    return {
      meta,
      fallbackText: isFallback
        ? `POS not closed → showing ${meta?.realPosTodayUsedDate}`
        : "",
      liveText: isLive ? "LIVE POS (BackOffice)" : "",
    };
  }, [kpis, date]);

  // ✅ placeholder: we do not have last-year week/month/year yet
  const lastYearWeek = 0;
  const lastYearMonth = 0;
  const lastYearYear = 0;

  const deltaToday =
    (kpis?.revenue?.today ?? 0) - (kpis?.revenue?.lastYearSameDay ?? 0);
  const deltaWeek = (kpis?.revenue?.week ?? 0) - lastYearWeek;
  const deltaMonth = (kpis?.revenue?.month ?? 0) - lastYearMonth;
  const deltaYear = (kpis?.revenue?.year ?? 0) - lastYearYear;

  const laborCostToday = kpis?.labor?.todayCost;
  const laborPctToday = kpis?.labor?.laborPctToday ?? null;

  const woltWeekRevenue = (kpis?.wolt?.byDay ?? []).reduce(
    (acc, x) => acc + (Number(x.revenue) || 0),
    0
  );

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
              {API_BASE_URL} (auto refresh 60 sec)
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="errorBox">Error: {error}</div> : null}
      {loading ? <div className="panel">Loading dashboard…</div> : null}

      {/* ✅ Split screen in 2 big areas */}
      <div className="splitLayout">
        {/* ================== TOP HALF ================== */}
        <div className="splitSection">
          <div className="sectionTitle">Sales + Planday</div>

          <div className="topHalfGrid">
            {/* ✅ 4 sales cards */}
            <div className="salesCardsGrid">
              <StatCard
                title="Sales Today"
                value={
                  <MoneyValue loading={loading} value={kpis?.revenue?.today} /> as any
                }
                subtitle={
                  derived.liveText ||
                  derived.fallbackText ||
                  "POS + Wolt (auto)"
                }
                deltaValue={loading ? null : deltaToday}
              />
              <StatCard
                title="Sales Week"
                value={
                  <MoneyValue loading={loading} value={kpis?.revenue?.week} /> as any
                }
                subtitle="Week = Monday → Sunday"
                deltaValue={loading ? null : deltaWeek}
              />
              <StatCard
                title="Sales Month"
                value={
                  <MoneyValue loading={loading} value={kpis?.revenue?.month} /> as any
                }
                subtitle="Month-to-date (auto POS range)"
                deltaValue={loading ? null : deltaMonth}
              />
              <StatCard
                title="Sales Year"
                value={
                  <MoneyValue loading={loading} value={kpis?.revenue?.year} /> as any
                }
                subtitle="Year-to-date (auto POS range)"
                deltaValue={loading ? null : deltaYear}
              />
            </div>

            {/* ✅ Planday big card (placeholder data for now) */}
            <Panel title="Planday (Shifts Today)" subtitle="Integration coming">
              <div className="shiftBox">
                <div className="shiftLine">
                  <div className="shiftName">Alex</div>
                  <div className="shiftTime">10:00 - 18:00</div>
                </div>
                <div className="shiftLine">
                  <div className="shiftName">Marius</div>
                  <div className="shiftTime">12:00 - 20:00</div>
                </div>
                <div className="shiftLine">
                  <div className="shiftName">Andrei</div>
                  <div className="shiftTime">14:00 - 22:00</div>
                </div>

                <div className="shiftTotals">
                  <div className="shiftTotalRow">
                    <div className="muted">Total Cost Today</div>
                    <div className="bright">
                      {loading ? "—" : `${fmtMoney(laborCostToday || 0)} DKK`}
                    </div>
                  </div>

                  <div className="shiftTotalRow">
                    <div className="muted">Labor % (Today)</div>
                    <div className="bright">
                      {loading
                        ? "—"
                        : laborPctToday === null
                        ? "—"
                        : `${Math.round(laborPctToday * 100)}%`}
                    </div>
                  </div>

                  <div className="shiftTotalRow">
                    <div className="muted">Labor % vs Last Year Same Day</div>
                    <div className="bright">Coming soon</div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* ================== BOTTOM HALF ================== */}
        <div className="splitSection">
          <div className="sectionTitle">COGS + Delivery Orders</div>

          <div className="bottomHalfGrid">
            <Panel
              title="COGS (BC Catering + Inco)"
              subtitle="Integration coming (week totals)"
            >
              <div className="simpleList">
                <div className="simpleRow">
                  <div className="muted">BC + Inco Orders (Week)</div>
                  <div className="bright">Coming soon</div>
                </div>
                <div className="simpleRow">
                  <div className="muted">Cost of Goods (Week)</div>
                  <div className="bright">Coming soon</div>
                </div>
                <div className="simpleRow">
                  <div className="muted">COGS % of Week Sales</div>
                  <div className="bright">Coming soon</div>
                </div>
              </div>
            </Panel>

            <Panel
              title="Delivery Orders (Wolt)"
              subtitle="Integration coming (daily + weekly total)"
            >
              <div className="simpleList">
                <div className="simpleRow">
                  <div className="muted">Delivery Orders (Week)</div>
                  <div className="bright">Coming soon</div>
                </div>
                <div className="simpleRow">
                  <div className="muted">Delivery Revenue (Week)</div>
                  <div className="bright">
                    {loading ? "—" : `${fmtMoney(woltWeekRevenue)} DKK`}
                  </div>
                </div>
              </div>

              <div className="panelNote">
                Wolt integration will replace saved placeholder values.
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <div className="footerNote">
        Next upgrades: location dropdown, last year week/month/year comparisons,
        Planday real shifts, BC/Inco real invoices.
      </div>
    </div>
  );
}
