import { useEffect, useState } from "react";
import "./App.css";

type KpiResponse = {
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
    byDay: Array<{ date: string; revenue: number }>;
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

function money(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function pct(n: number | null) {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export default function App() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKpis = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/kpis?date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as KpiResponse;
      setKpis(json);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    }
  };

  // ✅ Real-time refresh every 60 sec
  useEffect(() => {
    loadKpis();
    const id = window.setInterval(loadKpis, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL, date]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <h1>Restaurant KPI Dashboard</h1>

      <div style={{ marginTop: 8, opacity: 0.8 }}>
        API: <code>{API_BASE_URL}</code> (auto refresh 60 sec)
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ fontWeight: 700 }}>Select date:</label>
        <input
          style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: "1px solid #ccc" }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid red", borderRadius: 8 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!kpis && !error && <p style={{ marginTop: 12 }}>Loading KPIs...</p>}

      {kpis && (
        <>
          <h2 style={{ marginTop: 16 }}>KPIs for {kpis.date}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            <Card title="Daily Revenue" value={`${money(kpis.revenue.today)} DKK`} />
            <Card title="Weekly Revenue" value={`${money(kpis.revenue.week)} DKK`} />
            <Card title="Monthly Revenue" value={`${money(kpis.revenue.month)} DKK`} />
            <Card title="Yearly Revenue" value={`${money(kpis.revenue.year)} DKK`} />
            <Card title="Last Year (Same Day)" value={`${money(kpis.revenue.lastYearSameDay)} DKK`} />

            <Card title="Wolt Revenue (Today)" value={`${money(kpis.wolt.today)} DKK`} />
            <Card title="Labor Cost (Today)" value={`${money(kpis.labor.todayCost)} DKK`} />
            <Card title="Labor Cost % (Today)" value={pct(kpis.labor.laborPctToday)} />
            <Card title="BC Grocery Cost (Today)" value={`${money(kpis.cogs.todayCost)} DKK`} />
            <Card title="COGS % (Today)" value={pct(kpis.cogs.cogsPctToday)} />
          </div>

          <h2 style={{ marginTop: 16 }}>Wolt Revenue by Day (last 7 days)</h2>

          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            {kpis.wolt.byDay.length === 0 ? (
              <p>No data yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Date</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Wolt Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.wolt.byDay.map((x) => (
                    <tr key={x.date}>
                      <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{x.date}</td>
                      <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #f3f3f3" }}>
                        {money(x.revenue)} DKK
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Card(props: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
      <div style={{ opacity: 0.7, fontSize: 13 }}>{props.title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{props.value}</div>
    </div>
  );
}

