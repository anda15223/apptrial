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

type DailyInput = {
  date: string;
  totalRevenue: number;
  woltRevenue: number;
  laborCost: number;
  bcGroceryCost: number;
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

  const [form, setForm] = useState<DailyInput>({
    date: new Date().toISOString().slice(0, 10),
    totalRevenue: 0,
    woltRevenue: 0,
    laborCost: 0,
    bcGroceryCost: 0,
  });

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

  useEffect(() => {
    loadKpis();
    const id = window.setInterval(loadKpis, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL, date]);

  const saveToday = async () => {
    try {
      setError(null);

      const res = await fetch(`${API_BASE_URL}/api/inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Save failed: HTTP ${res.status} ${txt}`);
      }

      setDate(form.date);
      await loadKpis();
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <h1>Restaurant KPI Dashboard</h1>

      <div style={{ marginTop: 6, opacity: 0.8 }}>
        API: <code>{API_BASE_URL}</code> (auto refresh 60 sec)
      </div>

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Update Today (2 minutes)</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Date (YYYY-MM-DD)">
            <input style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>

          <Field label="Total Revenue (DKK)">
            <input
              style={inputStyle}
              type="number"
              value={form.totalRevenue}
              onChange={(e) => setForm({ ...form, totalRevenue: Number(e.target.value) })}
            />
          </Field>

          <Field label="Wolt Revenue (DKK)">
            <input
              style={inputStyle}
              type="number"
              value={form.woltRevenue}
              onChange={(e) => setForm({ ...form, woltRevenue: Number(e.target.value) })}
            />
          </Field>

          <Field label="Labor Cost (Planday shifts cost) (DKK)">
            <input
              style={inputStyle}
              type="number"
              value={form.laborCost}
              onChange={(e) => setForm({ ...form, laborCost: Number(e.target.value) })}
            />
          </Field>

          <Field label="BC Grocery Cost (DKK)">
            <input
              style={inputStyle}
              type="number"
              value={form.bcGroceryCost}
              onChange={(e) => setForm({ ...form, bcGroceryCost: Number(e.target.value) })}
            />
          </Field>
        </div>

        <button
          onClick={saveToday}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          Update Today
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 700 }}>Dashboard Date:</label>
        <input style={{ ...inputStyle, marginTop: 6 }} value={date} onChange={(e) => setDate(e.target.value)} />
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
};

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontWeight: 700 }}>{props.label}</div>
      <div style={{ marginTop: 6 }}>{props.children}</div>
    </label>
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
