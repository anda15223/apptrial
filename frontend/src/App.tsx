import { useEffect, useMemo, useState } from "react";
import "./App.css";

/* ================= TYPES ================= */

type KpisResponse = {
  date: string;
  revenue: {
    today: number;
    week: number;
    weekToDate: number;
    month: number;
    monthToDate: number;
    year: number;

    lastYearSameDay: number;
    lastYearSameWeekday: number;
    lastYearSameWeekdayDate: string;

    lastYearWeek: number;
    lastYearWeekRange?: { from: string; to: string };

    lastYearMonth: number;
    lastYearYear: number;
  };

  comparisons: {
    todayVsLastYearSameWeekday: {
      diff: number;
      direction: "up" | "down" | "flat";
    };
    weekVsLastYearWeek: {
      diff: number;
      direction: "up" | "down" | "flat";
    };
    monthVsLastYearMonth: {
      diff: number;
      direction: "up" | "down" | "flat";
    };
    yearVsLastYearYear: {
      diff: number;
      direction: "up" | "down" | "flat";
    };
  };

  meta?: {
    cached?: boolean;
    cacheAgeSeconds?: number;
  };
};

type LaborResp = {
  laborCost: number;
};

type ScheduleItem = {
  employee: string;
  from: string;
  to: string;
};

/* ================= CONFIG ================= */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://apptrial-c8km.onrender.com";

const VAT_RATE = 0.25;

/* ================= HELPERS ================= */

function fmtMoney(n: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n);
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function directionToKind(d?: "up" | "down" | "flat") {
  if (d === "up") return "green";
  if (d === "down") return "red";
  return "neutral";
}

function pctLamp(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) return "neutral" as const;
  if (pct <= 20) return "green" as const;
  if (pct <= 25) return "neutral" as const;
  return "red" as const;
}

function pctText(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}

/* ================= UI ================= */

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
          {subtitle && <div className="panelSubtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="panelBody">{children}</div>
    </div>
  );
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
  delta,
  direction,
}: {
  title: string;
  value: string;
  subtitle?: string;
  delta?: number;
  direction?: "up" | "down" | "flat";
}) {
  return (
    <div className="statCard">
      <div className="statTop">
        <div className="statTitle">{title}</div>
        <MiniPill
          kind={directionToKind(direction)}
          text={
            typeof delta === "number"
              ? `${delta >= 0 ? "+" : ""}${fmtMoney(delta)} DKK`
              : "—"
          }
        />
      </div>
      <div className="statValue">{value}</div>
      {subtitle && <div className="smallNote">{subtitle}</div>}
    </div>
  );
}

/* ================= APP ================= */

export default function App() {
  const [date] = useState(getTodayIso());
  const [kpis, setKpis] = useState<KpisResponse | null>(null);

  const [laborDay, setLaborDay] = useState<LaborResp | null>(null);
  const [laborWeek, setLaborWeek] = useState<LaborResp | null>(null);
  const [laborMonth, setLaborMonth] = useState<LaborResp | null>(null);
  const [laborYear, setLaborYear] = useState<LaborResp | null>(null);

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/kpis?date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setKpis);

    Promise.all([
      fetch(`${API_BASE_URL}/api/labor/day?date=${date}`),
      fetch(`${API_BASE_URL}/api/labor/week?date=${date}`),
      fetch(`${API_BASE_URL}/api/labor/month?date=${date}`),
      fetch(`${API_BASE_URL}/api/labor/year?date=${date}`),
      fetch(`${API_BASE_URL}/api/labor/schedule/today?date=${date}`),
    ]).then(async ([d, w, m, y, s]) => {
      if (d.ok) setLaborDay(await d.json());
      if (w.ok) setLaborWeek(await w.json());
      if (m.ok) setLaborMonth(await m.json());
      if (y.ok) setLaborYear(await y.json());
      if (s.ok) {
        const data = await s.json();
        setSchedule(data.schedule ?? []);
      }
    });
  }, [date]);

  /* ---------- VAT-adjusted sales ---------- */

  const salesToday = kpis?.revenue.today ?? 0;
  const salesWeek = kpis?.revenue.week ?? 0;
  const salesMonth = kpis?.revenue.month ?? 0;
  const salesYear = kpis?.revenue.year ?? 0;

  const netToday = salesToday / (1 + VAT_RATE);
  const netWeek = salesWeek / (1 + VAT_RATE);
  const netMonth = salesMonth / (1 + VAT_RATE);
  const netYear = salesYear / (1 + VAT_RATE);

  const pctToday = laborDay ? (laborDay.laborCost / netToday) * 100 : null;
  const pctWeek = laborWeek ? (laborWeek.laborCost / netWeek) * 100 : null;
  const pctMonth = laborMonth ? (laborMonth.laborCost / netMonth) * 100 : null;
  const pctYear = laborYear ? (laborYear.laborCost / netYear) * 100 : null;

  return (
    <div className="page">
      <div className="topHeader">
        <div className="brand">
          <div className="brandTitle">Dashboard</div>
          <div className="brandSub">
            Location: <span className="brandSubStrong">Aarhus (Gaia)</span>
          </div>
        </div>
      </div>

      <div className="splitLayout">
        <div className="splitSection">
          <div className="sectionTitle">Sales + Planday</div>

          <div className="topHalfGrid">
            <div className="salesCardsGrid">
              <StatCard
                title="Sales Today"
                value={`${fmtMoney(salesToday)} DKK`}
                delta={kpis?.comparisons.todayVsLastYearSameWeekday.diff}
                direction={kpis?.comparisons.todayVsLastYearSameWeekday.direction}
              />
              <StatCard
                title="Sales Week"
                value={`${fmtMoney(salesWeek)} DKK`}
                delta={kpis?.comparisons.weekVsLastYearWeek.diff}
                direction={kpis?.comparisons.weekVsLastYearWeek.direction}
              />
              <StatCard
                title="Sales Month"
                value={`${fmtMoney(salesMonth)} DKK`}
                delta={kpis?.comparisons.monthVsLastYearMonth.diff}
                direction={kpis?.comparisons.monthVsLastYearMonth.direction}
              />
              <StatCard
                title="Sales Year"
                value={`${fmtMoney(salesYear)} DKK`}
                delta={kpis?.comparisons.yearVsLastYearYear.diff}
                direction={kpis?.comparisons.yearVsLastYearYear.direction}
              />
            </div>

            <Panel title="Planday (Labor)" subtitle="Labor cost + % of sales">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <LaborRow
                  label="Today labor cost"
                  cost={laborDay?.laborCost}
                  pct={pctToday}
                />
                <LaborRow
                  label="Week labor cost"
                  cost={laborWeek?.laborCost}
                  pct={pctWeek}
                />
                <LaborRow
                  label="Month labor cost"
                  cost={laborMonth?.laborCost}
                  pct={pctMonth}
                />
                <LaborRow
                  label="Year labor cost"
                  cost={laborYear?.laborCost}
                  pct={pctYear}
                />

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Today schedule
                  </div>

                  {schedule.length === 0 ? (
                    <div>—</div>
                  ) : (
                    schedule.map((s, i) => (
                      <div key={i}>
                        • {s.employee} — {s.from} → {s.to}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>

        <div className="splitSection">
          <div className="sectionTitle">Next modules</div>

          <Panel title="COGS" subtitle="Integration coming" />
          <Panel title="Delivery Orders" subtitle="Integration coming" />
        </div>
      </div>

      <div className="footerNote">
        Today compares to same weekday last year (52 weeks ago).
      </div>
    </div>
  );
}

/* ================= LABOR ROW ================= */

function LaborRow({
  label,
  cost,
  pct,
}: {
  label: string;
  cost?: number;
  pct: number | null;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <div>{typeof cost === "number" ? `${fmtMoney(cost)} DKK` : "—"}</div>
      </div>
      <MiniPill kind={pctLamp(pct)} text={pctText(pct)} />
    </div>
  );
}
