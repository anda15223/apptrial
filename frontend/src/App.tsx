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
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://apptrial.onrender.com";

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

function DeltaPill({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={`pill ${isPositive ? "pillGreen" : "pillRed"}`}>
      {isPositive ? "+" : ""}
      {value}%
    </span>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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

function KpiRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  return (
    <div className="kpiRow">
      <div className="kpiLabel">{label}</div>
      <div className="kpiRight">
        <div className="kpiValue">{value}</div>
        {typeof delta === "number" ? <DeltaPill value={delta} /> : <span className="pill pillNeutral">—</span>}
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  percent,
  highlight,
}: {
  label: string;
  value: string;
  percent: number;
  highlight?: boolean;
}) {
  return (
    <div className="funnelRow">
      <div className="funnelLabel">{label}</div>
      <div className="funnelBar">
        <div className="funnelBarBg">
          <div
            className={`funnelBarFill ${highlight ? "funnelBarFillGreen" : ""}`}
            style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
          />
        </div>
      </div>
      <div className="funnelValue">{value}</div>
    </div>
  );
}

function Tile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  return (
    <div className="tile">
      <div className="tileLabel">{label}</div>
      <div className="tileValue">{value}</div>
      <div className="tileFooter">
        {typeof delta === "number" ? <DeltaPill value={delta} /> : <span className="pill pillNeutral">—</span>}
      </div>
    </div>
  );
}

function SalesGauge({ actual, target }: { actual: number; target: number }) {
  // simple semicircle gauge using CSS conic-gradient in a circle mask
  const pct = target <= 0 ? 0 : Math.min(1, actual / target);
  const angle = Math.round(pct * 180);

  return (
    <div className="gaugeWrap">
      <div
        className="gauge"
        style={{
          background: `conic-gradient(from 180deg, rgba(255,255,255,0.08) 0deg, rgba(255,255,255,0.08) 180deg)`,
        }}
      >
        <div
          className="gaugeFill"
          style={{
            background: `conic-gradient(from 180deg, rgba(74,222,128,0.9) 0deg, rgba(74,222,128,0.9) ${angle}deg, rgba(255,255,255,0.08) ${angle}deg, rgba(255,255,255,0.08) 180deg)`,
          }}
        />
        <div className="gaugeInner" />
        <div className="gaugeCenter">
          <div className="gaugeNumber">{fmtMoney(actual)} DKK</div>
          <div className="gaugeSub">Target: {fmtMoney(target)} DKK</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [date, setDate] = useState(getTodayIso());
  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // manual inputs
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [woltRevenue, setWoltRevenue] = useState<number>(0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [bcGroceryCost, setBcGroceryCost] = useState<number>(0);

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
    }
  }

  async function updateToday() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          totalRevenue,
          woltRevenue,
          laborCost,
          bcGroceryCost,
        }),
      });
      if (!res.ok) throw new Error(`Update error: ${res.status}`);
      await loadKpis();
    } catch (e: any) {
      setError(e?.message || "Update failed");
    }
  }

  useEffect(() => {
    loadKpis();
    const t = setInterval(loadKpis, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const salesTargetToday = 10000;

  const derived = useMemo(() => {
    const revToday = kpis?.revenue.today ?? 0;
    const woltToday = kpis?.wolt.today ?? 0;
    const laborToday = kpis?.labor.todayCost ?? 0;
    const cogsToday = kpis?.cogs.todayCost ?? 0;

    const profitEstimateToday = revToday - laborToday - cogsToday;

    return {
      revToday,
      woltToday,
      laborToday,
      cogsToday,
      profitEstimateToday,
    };
  }, [kpis]);

  return (
    <div className="page">
      <div className="topHeader">
        <div className="brand">
          <div className="brandTitle">Restaurant Dashboard</div>
          <div className="brandSub">
            Location: <span className="brandSubStrong">{locationName}</span>
          </div>
        </div>

        <div className="topControls">
          <div className="controlBlock">
            <div className="controlLabel">Dashboard Date</div>
            <input
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>

          <div className="controlBlock">
            <div className="controlLabel">API</div>
            <div className="apiLine">{API_BASE_URL} (auto refresh 60 sec)</div>
          </div>
        </div>
      </div>

      {/* Manual update panel (kept, but styled) */}
      <div className="manualPanel">
        <div className="manualHeader">
          <div>
            <div className="panelTitle">Update Today (2 minutes)</div>
            <div className="panelSubtitle">Manual fallback stays even after APIs</div>
          </div>
          <button className="btnPrimary" onClick={updateToday}>
            Update Today
          </button>
        </div>

        <div className="manualGrid">
          <div className="field">
            <div className="fieldLabel">Total Revenue (DKK)</div>
            <input
              className="input"
              type="number"
              value={totalRevenue}
              onChange={(e) => setTotalRevenue(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <div className="fieldLabel">Wolt Revenue (DKK)</div>
            <input
              className="input"
              type="number"
              value={woltRevenue}
              onChange={(e) => setWoltRevenue(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <div className="fieldLabel">Labor Cost (DKK)</div>
            <input
              className="input"
              type="number"
              value={laborCost}
              onChange={(e) => setLaborCost(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <div className="fieldLabel">Food Cost (BC Grocery) (DKK)</div>
            <input
              className="input"
              type="number"
              value={bcGroceryCost}
              onChange={(e) => setBcGroceryCost(Number(e.target.value))}
            />
          </div>
        </div>

        {error ? <div className="errorBox">Error: {error}</div> : null}
      </div>

      {/* Main dashboard grid */}
      <div className="grid12">
        {/* Top left panel (4/12) */}
        <div className="col4">
          <Panel title="Restaurant KPIs" subtitle="Today summary (live)">
            <div className="kpiList">
              <KpiRow label="Total Sales (Today)" value={`${fmtMoney(kpis?.revenue.today ?? 0)} DKK`} delta={+5} />
              <KpiRow label="Total Sales (Week)" value={`${fmtMoney(kpis?.revenue.week ?? 0)} DKK`} delta={+3} />
              <KpiRow label="Total Sales (Month)" value={`${fmtMoney(kpis?.revenue.month ?? 0)} DKK`} delta={-2} />
              <KpiRow label="Week vs Last Year" value="Coming soon" delta={0} />
              <KpiRow label="Wolt Sales (Today)" value={`${fmtMoney(kpis?.wolt.today ?? 0)} DKK`} delta={+1} />
              <KpiRow label="Labor Cost (Today)" value={`${fmtMoney(kpis?.labor.todayCost ?? 0)} DKK`} />
              <KpiRow label="Labor % (Today)" value={fmtPct(kpis?.labor.laborPctToday ?? null)} />
              <KpiRow label="Food Cost (Today)" value={`${fmtMoney(kpis?.cogs.todayCost ?? 0)} DKK`} />
              <KpiRow label="Food % (Today)" value={fmtPct(kpis?.cogs.cogsPctToday ?? null)} />
              <KpiRow label="Profit Estimate (Today)" value={`${fmtMoney(derived.profitEstimateToday)} DKK`} />
            </div>
          </Panel>
        </div>

        {/* Top middle panel (5/12) */}
        <div className="col5">
          <Panel title="Sales Funnel / Order Flow" subtitle="Restaurant flow (placeholder until POS import)">
            <div className="funnel">
              <FunnelRow label="Gross Sales" value={`${fmtMoney(kpis?.revenue.today ?? 0)} DKK`} percent={90} />
              <FunnelRow label="Wolt Sales" value={`${fmtMoney(kpis?.wolt.today ?? 0)} DKK`} percent={60} />
              <FunnelRow label="Food Cost" value={`${fmtMoney(kpis?.cogs.todayCost ?? 0)} DKK`} percent={55} />
              <FunnelRow label="Labor Cost" value={`${fmtMoney(kpis?.labor.todayCost ?? 0)} DKK`} percent={45} />
              <FunnelRow
                label="Profit Estimate"
                value={`${fmtMoney(derived.profitEstimateToday)} DKK`}
                percent={70}
                highlight
              />
            </div>
            <div className="panelNote">
              Hourly sales + real funnel stages will update once PSO Online API is connected.
            </div>
          </Panel>
        </div>

        {/* Top right panel (3/12) */}
        <div className="col3">
          <Panel title="Leaderboard" subtitle="Top products (coming with POS data)">
            <div className="table">
              <div className="tableHeader">
                <div>Rank</div>
                <div>Product</div>
                <div className="right">Units</div>
                <div className="right">Revenue</div>
              </div>

              {[
                { r: 1, p: "Fish & Chips", u: 0, v: 0 },
                { r: 2, p: "Burger Menu", u: 0, v: 0 },
                { r: 3, p: "Shrimp Menu", u: 0, v: 0 },
                { r: 4, p: "Mix Plate", u: 0, v: 0 },
              ].map((x) => (
                <div className="tableRow" key={x.r}>
                  <div className="muted">{x.r}</div>
                  <div className="bright">{x.p}</div>
                  <div className="right muted">{x.u}</div>
                  <div className="right bright">{fmtMoney(x.v)} DKK</div>
                </div>
              ))}

              <div className="panelNote">
                This will become real automatically when PSO Online provides product lines.
              </div>
            </div>
          </Panel>
        </div>

        {/* Bottom left (9/12) - tiles */}
        <div className="col9">
          <div className="tilesGrid">
            <Tile label="Sales Today" value={`${fmtMoney(kpis?.revenue.today ?? 0)} DKK`} delta={+5} />
            <Tile label="Sales This Week" value={`${fmtMoney(kpis?.revenue.week ?? 0)} DKK`} delta={+3} />
            <Tile label="Sales This Month" value={`${fmtMoney(kpis?.revenue.month ?? 0)} DKK`} delta={-2} />
            <Tile label="Wolt Today" value={`${fmtMoney(kpis?.wolt.today ?? 0)} DKK`} delta={+1} />
            <Tile label="Labor % Today" value={fmtPct(kpis?.labor.laborPctToday ?? null)} />
            <Tile label="Food % Today" value={fmtPct(kpis?.cogs.cogsPctToday ?? null)} />
          </div>
        </div>

        {/* Bottom right (3/12) - gauge */}
        <div className="col3">
          <Panel title="Sales vs Target" subtitle="Today progress">
            <SalesGauge actual={derived.revToday} target={salesTargetToday} />
          </Panel>
        </div>
      </div>

      <div className="footerNote">
        Next upgrades: location dropdown (7 locations), KPI colors, Week vs Last Year, hourly sales import.
      </div>
    </div>
  );
}
