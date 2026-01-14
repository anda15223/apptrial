import express from "express";
import { listDailyInputs } from "../db/supabaseDb";
import { computeKpis } from "../kpi/engine";

export const kpisRouter = express.Router();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

kpisRouter.get("/", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : todayIso();

    const all = await listDailyInputs();
    const result = computeKpis(all, date);

    res.json(result);
  } catch (err: any) {
    console.error("GET /api/kpis error:", err);
    res.status(500).json({ error: "Failed to compute KPIs" });
  }
});
