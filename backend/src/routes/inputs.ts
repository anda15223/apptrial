import express from "express";
import { upsertDailyInput, listDailyInputs } from "../db/supabaseDb";

export const inputsRouter = express.Router();

// GET all saved inputs
inputsRouter.get("/", async (_req, res) => {
  try {
    const all = await listDailyInputs();
    res.json(all);
  } catch (err: any) {
    console.error("GET /api/inputs error:", err);
    res.status(500).json({ error: "Failed to load inputs" });
  }
});

// POST save/update one day input
inputsRouter.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};

    const date = String(body.date || "").trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const saved = await upsertDailyInput({
      date,
      totalRevenue: Number(body.totalRevenue ?? 0),
      woltRevenue: Number(body.woltRevenue ?? 0),
      laborCost: Number(body.laborCost ?? 0),
      bcGroceryCost: Number(body.bcGroceryCost ?? 0),
    });

    return res.json(saved);
  } catch (err: any) {
    console.error("POST /api/inputs error:", err);
    return res.status(500).json({ error: "Failed to save input" });
  }
});
