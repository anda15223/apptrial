import { Router } from "express";
import { upsertDailyInput, listDailyInputs } from "../db/fileDb";

export const inputsRouter = Router();

// List all saved days
inputsRouter.get("/", (_req, res) => {
  res.json(listDailyInputs());
});

// Save / update one day
inputsRouter.post("/", (req, res) => {
  const body = req.body ?? {};

  const date = String(body.date || "").trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }

  const saved = upsertDailyInput({
    date,
    totalRevenue: Number(body.totalRevenue ?? 0),
    woltRevenue: Number(body.woltRevenue ?? 0),
    laborCost: Number(body.laborCost ?? 0),
    bcGroceryCost: Number(body.bcGroceryCost ?? 0),
  });

  return res.json(saved);
});

