import { useEffect, useMemo, useState } from "react";
import "./App.css";

type DashboardTodayResponse = {
  date: string;
  revenue: { pos: number; wolt: number; total: number };
  orders: { pos: number; wolt: number };
  labor: { staffScheduled: number };
  woltLiveOrders: Array<any>;
};

function App() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

  const [data, setData] = useState<DashboardTodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = useMemo(() => {
    return `${API_BASE_URL}/api/dashboard/today`;
  }, [API_BASE_URL]);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DashboardTodayResponse;
        setData(json);
      } catch (e: any) {
        setError(e?.message || "Unknown error");
      }
    };

    load();
  }, [apiUrl]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Gyros 2 Dashboard</h1>

      <p style={{ opacity: 0.7 }}>
        API: <code>{apiUrl}</code>
      </p>

      {error && (
        <div style={{ padding: 12, border: "1px solid red" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!data && !error && <p>Loading...</p>}

      {data && (
        <>
          <h2>KPIs (Today: {data.date})</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginTop: 12,
            }}
          >
            <div style={{ border: "1px solid #ddd", padding: 12 }}>
              <div style={{ opacity: 0.7 }}>Revenue Total</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {data.revenue.total}
              </div>
            </div>

            <div style={{ border: "1px solid #ddd", padding: 12 }}>
              <div style={{ opacity: 0.7 }}>Orders (POS)</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {data.orders.pos}
              </div>
            </div>

            <div style={{ border: "1px solid #ddd", padding: 12 }}>
              <div style={{ opacity: 0.7 }}>Orders (Wolt)</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {data.orders.wolt}
              </div>
            </div>
          </div>

          <h2 style={{ marginTop: 24 }}>Revenue Breakdown</h2>
          <ul>
            <li>POS: {data.revenue.pos}</li>
            <li>Wolt: {data.revenue.wolt}</li>
            <li>Total: {data.revenue.total}</li>
          </ul>

          <h2 style={{ marginTop: 24 }}>
            Live Wolt Orders ({data.woltLiveOrders.length})
          </h2>

          {data.woltLiveOrders.length === 0 ? (
            <p>No live orders right now.</p>
          ) : (
            <pre
              style={{
                background: "#111",
                color: "#eee",
                padding: 12,
                borderRadius: 6,
                overflow: "auto",
              }}
            >
              {JSON.stringify(data.woltLiveOrders, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

export default App;
