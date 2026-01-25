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
    laborPctToday: number | null; // fraction (e.g. 0.25)
  };
  cogs: {
    todayCost: number;
    cogsPctToday: number | null; // fraction (e.g. 0.23)
  };
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://apptrial.onrender.com";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number | null) {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

function getTodayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function DiffPillMoney({ value }: { value: number | null }) {
  if (value === null) return <span className="pill pillNeutral">—</span>;
  const isPositive = value >= 0;
  return (
    <span className={`pill ${isPositive ? "pillGreen" : "pillRed"}`}>
      {isPositive ? "+" : "−"}
      {fmtMoney(Math.abs(value))} DKK
    </span>
  );
}

function StatusPill({ status }: { status: "green" | "yellow" | "red" }) {
  return (
    <span
      className={`pill ${
        status === "green"
          ? "pillGreen"
          : status === "yellow"
          ? "pillYellow"
          : "pillRed"
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

/**
 * Labor thresholds:
 * Green <= 25%
 * Yellow <= 35%
 * Red > 35%
 */
function laborPctStatus(pct: number | null): "green" | "yellow" | "red" {
  if (pct === null) return "yellow";
  const p = pct * 100;
  if (p <= 25) return "green";
  if (p <= 35) return "yellow";
  return "red";
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

function MiniRow({
  label,
  value,
  right,
}: {
  label: string;
  value: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="kpiRow">
      <div className="kpiLabel">{label}</div>
      <div className="kpiRight">
        <div className="kpiValue">{value}</div>
        {right ?? <span className="pill pillNeutral">—</span>}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel" style={{ padding: 0, margin: 0, borderRadius: 16 }}>
      <div className="panelHeader">
        <div className="panelTitle">{title}</div>
      </div>
      <div className="panelBody">{children}</div>
    </div>
  );
}

function calcPct(cost: number, sales: number): number | null {
  if (!Number.isFinite(cost) || !Number.isFinite(sales) || sales <= 0)
    return null;
  return cost / sales;
}

type LocationKey = "gaia" | "fishbistro" | "reffen" | "helsingor" | "zoo";

const LOCATIONS: { key: LocationKey; label: string }[] = [
  { key: "gaia", label: "Aarhus (Gaia)" },
  { key: "fishbistro", label: "Fish Bistro" },
  { key: "reffen", label: "Reffen" },
  { key: "helsingor", label: "Helsingør" },
  { key: "zoo", label: "Zoo" },
];

export default function App() {
  // ✅ Date must not be editable
  const [date] = useState(getTodayIso());

  // ✅ Location dropdown (scroll + select)
  const [locationKey, setLocationKey] = useState<LocationKey>("gaia");

  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locationName =
    LOCATIONS.find((l) => l.key === locationKey)?.label ?? "Unknown location";

  async function loadKpis() {
    try {
      setError(null);

      // ✅ For now backend still returns 1 store KPIs.
      // Later we will use locationKey to call backend with ?location=...
      const res = await fetch(`${API_BASE_URL}/api/kpis?date=${date}`);

      if (!res.ok) throw new Error(`KPIs error: ${res.status}`);
      const data = (await res.json()) as KpisResponse;
      setKpis(data);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch KPIs");
    }
  }

  useEffect(() => {
    loadKpis();
    const t = setInterval(loadKpis, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, locationKey]);

  const derived = useMemo(() => {
    const salesToday = kpis?.revenue.today ?? 0;
    const salesTodayLY = kpis?.revenue.lastYearSameDay ?? 0;

    const salesWeek = kpis?.revenue.week ?? 0;
    const salesMonth = kpis?.revenue.month ?? 0;
    const salesYear = kpis?.revenue.year ?? 0;

    // Last-year week/month/year not implemented yet
    const salesWeekLY: number | null = null;
    const salesMonthLY: number | null = null;
    const salesYearLY: number | null = null;

    const diffToday = salesToday - salesTodayLY;
    const diffWeek = salesWeekLY === null ? null : salesWeek - salesWeekLY;
    const diffMonth = salesMonthLY === null ? null : salesMonth - salesMonthLY;
    const diffYear = salesYearLY === null ? null : salesYear - salesYearLY;

    const laborCostToday = kpis?.labor.todayCost ?? 0;
    const laborPctVsTodaySales = calcPct(laborCostToday, salesToday);
    const laborPctVsLastYearSameDaySales = calcPct(laborCostToday, salesTodayLY);

    return {
      salesToday,
      salesTodayLY,
      diffToday,

      salesWeek,
      salesWeekLY,
      diffWeek,

      salesMonth,
      salesMonthLY,
      diffMonth,

      salesYear,
      salesYearLY,
      diffYear,

      laborCostToday,
      laborPctVsTodaySales,
      laborPctVsLastYearSameDaySales,
    };
  }, [kpis]);

  // Placeholder data (APIs later)
  const shiftsTodayPlaceholder = [
    { name: "Andrei", time: "10:00–18:00" },
    { name: "Costel", time: "12:00–20:00" },
    { name: "Marius", time: "16:00–22:00" },
  ];

  const opsPlaceholder = {
    bcOrdersWeek: 0,
    incoOrdersWeek: 0,
    deliveryOrdersTotal: 0,
    goodsCostWeek: 0,
  };

  const cogsPctWeek = calcPct(opsPlaceholder.goodsCostWeek, derived.salesWeek);

  return (
    <div className="page">
      <div className="topHeader">
        <div className="brand">
          {/* ✅ Title change */}
          <div className="brandTitle">Dashboard</div>

          <div className="brandSub">
            Location: <span className="brandSubStrong">{locationName}</span>
          </div>
        </div>

        <div className="topControls">
          {/* ✅ Location dropdown */}
          <div className="controlBlock">
            <div className="controlLabel">Location</div>
            <select
              className="input"
              value={locationKey}
              onChange={(e) => setLocationKey(e.target.value as LocationKey)}
            >
              {LOCATIONS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ Date NOT editable */}
          <div className="controlBlock">
            <div className="controlLabel">Dashboard Date</div>
            <div className="apiLine">{date}</div>
          </div>

          <div className="controlBlock">
            <div className="controlLabel">API</div>
            <div className="apiLine">{API_BASE_URL} (auto refresh 60 sec)</div>
          </div>
        </div>
      </div>

      {error ? <div className="errorBox">Error: {error}</div> : null}

      {/* TWO BIG QUADRANTS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* UPPER QUADRANT */}
        <Panel title="Sales Overview" subtitle="POS + Wolt (Wolt placeholders until integration)">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <Card title="Sales Today">
              <div className="kpiList">
                <MiniRow label="Today" value={`${fmtMoney(derived.salesToday)} DKK`} />
                <MiniRow
                  label="Last year same day"
                  value={`${fmtMoney(derived.salesTodayLY)} DKK`}
                />
                <MiniRow
                  label="Difference"
                  value=""
                  right={<DiffPillMoney value={derived.diffToday} />}
                />
              </div>
            </Card>

            <Card title="Sales Week">
              <div className="kpiList">
                <MiniRow label="This week" value={`${fmtMoney(derived.salesWeek)} DKK`} />
                <MiniRow
                  label="Last year same week"
                  value={derived.salesWeekLY === null ? "—" : `${fmtMoney(derived.salesWeekLY)} DKK`}
                />
                <MiniRow label="Difference" value="" right={<DiffPillMoney value={derived.diffWeek} />} />
                <div className="panelNote" style={{ marginTop: 8 }}>
                  Last-year week requires backend support (next step).
                </div>
              </div>
            </Card>

            <Card title="Sales Month">
              <div className="kpiList">
                <MiniRow label="This month" value={`${fmtMoney(derived.salesMonth)} DKK`} />
                <MiniRow
                  label="Last year same month"
                  value={derived.salesMonthLY === null ? "—" : `${fmtMoney(derived.salesMonthLY)} DKK`}
                />
                <MiniRow
                  label="Difference"
                  value=""
                  right={<DiffPillMoney value={derived.diffMonth} />}
                />
                <div className="panelNote" style={{ marginTop: 8 }}>
                  Last-year month requires backend support (next step).
                </div>
              </div>
            </Card>

            <Card title="Sales Year">
              <div className="kpiList">
                <MiniRow label="This year" value={`${fmtMoney(derived.salesYear)} DKK`} />
                <MiniRow
                  label="Last year"
                  value={derived.salesYearLY === null ? "—" : `${fmtMoney(derived.salesYearLY)} DKK`}
                />
                <MiniRow label="Difference" value="" right={<DiffPillMoney value={derived.diffYear} />} />
                <div className="panelNote" style={{ marginTop: 8 }}>
                  Last-year year-to-date requires backend support (next step).
                </div>
              </div>
            </Card>
          </div>
        </Panel>

        {/* DOWN QUADRANT */}
        <Panel title="Operations" subtitle="Planday + Ordering (API integrations added later)">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <Card title="Planday">
              <div className="kpiList">
                <div style={{ marginBottom: 10 }}>
                  <div className="panelSubtitle" style={{ marginBottom: 6 }}>
                    Shifts Today (names + schedule)
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {shiftsTodayPlaceholder.map((s) => (
                      <div
                        key={s.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div className="bright">{s.name}</div>
                        <div className="muted">{s.time}</div>
                      </div>
                    ))}
                  </div>

                  <div className="panelNote" style={{ marginTop: 8 }}>
                    Placeholder until Planday integration is connected.
                  </div>
                </div>

                <MiniRow
                  label="Total labor cost (today)"
                  value={`${fmtMoney(derived.laborCostToday)} DKK`}
                />

                <div className="kpiRow">
                  <div className="kpiLabel">Labor % of sales today</div>
                  <div className="kpiRight">
                    <div className="kpiValue">{fmtPct(derived.laborPctVsTodaySales)}</div>
                    <StatusPill status={laborPctStatus(derived.laborPctVsTodaySales)} />
                  </div>
                </div>

                <div className="kpiRow">
                  <div className="kpiLabel">Labor % of last year same day sales</div>
                  <div className="kpiRight">
                    <div className="kpiValue">
                      {fmtPct(derived.laborPctVsLastYearSameDaySales)}
                    </div>
                    <StatusPill status={laborPctStatus(derived.laborPctVsLastYearSameDaySales)} />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="BC / Inco / Delivery + COGS">
              <div className="kpiList">
                <MiniRow label="BC orders (week)" value={`${fmtMoney(opsPlaceholder.bcOrdersWeek)} DKK`} />
                <MiniRow label="Inco orders (week)" value={`${fmtMoney(opsPlaceholder.incoOrdersWeek)} DKK`} />
                <MiniRow
                  label="Delivery orders total"
                  value={`${fmtMoney(opsPlaceholder.deliveryOrdersTotal)} DKK`}
                />

                <div style={{ height: 8 }} />

                <MiniRow label="Goods cost (week)" value={`${fmtMoney(opsPlaceholder.goodsCostWeek)} DKK`} />

                <div className="kpiRow">
                  <div className="kpiLabel">COGS % (week) = goods / sales</div>
                  <div className="kpiRight">
                    <div className="kpiValue">{fmtPct(cogsPctWeek)}</div>
                    <span className="pill pillNeutral">DATA LATER</span>
                  </div>
                </div>

                <div className="panelNote" style={{ marginTop: 8 }}>
                  Placeholder. Separate database + API will be linked later.
                </div>
              </div>
            </Card>
          </div>
        </Panel>
      </div>

      <div className="footerNote">
        Next steps: backend support for last-year week/month/year comparisons,
        then connect Planday + BC/Inco/Delivery sources.
      </div>
    </div>
  );
}
