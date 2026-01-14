import { Router } from "express";
import { listDailyInputs } from "../db/fileDb";
import { computeKpis } from "../kpi/engine";
import { todayIso } from "../utils/date";

export const kpisRouter = Router();

// GET /api/kpis?date=YYYY-MM-DD
kpisRouter.get("/", (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : todayIso();
  const all = listDailyInputs();
  res.json(computeKpis(all, date));
});
