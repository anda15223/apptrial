import express from "express";
import { db } from "./db";
import { parsePlandayHtml } from "./parsePlandayHtml";

const router = express.Router();

const UPLIFT_PCT = 15.74;
const UPLIFT_FACTOR = 1 + UPLIFT_PCT / 100;

/* ================= IMPORT ================= */

router.post("/import", express.text({ type: "*/*" }), (req, res) => {
  const html = req.body;
  if (!html) {
    return res.status(400).json({ error: "Missing HTML body" });
  }

  const result = parsePlandayHtml(html);
  res.json({ status: "ok", ...result });
});

/* ================= DAY ================= */

router.get("/day", (req, res) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Missing date" });

  const rows = db
    .prepare(`SELECT amount FROM labor_entries WHERE date = ?`)
    .all(date) as { amount: number }[];

  const baseCost = rows.reduce((s, r) => s + r.amount, 0);
  const laborCost = Number((baseCost * UPLIFT_FACTOR).toFixed(2));

  res.json({ date, upliftPct: UPLIFT_PCT, baseCost, laborCost });
});

/* ================= WEEK ================= */

router.get("/week", (req, res) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Missing date" });

  const d = new Date(date);
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = monday.toISOString().slice(0, 10);
  const to = sunday.toISOString().slice(0, 10);

  const rows = db
    .prepare(`SELECT amount FROM labor_entries WHERE date BETWEEN ? AND ?`)
    .all(from, to) as { amount: number }[];

  const baseCost = rows.reduce((s, r) => s + r.amount, 0);
  const laborCost = Number((baseCost * UPLIFT_FACTOR).toFixed(2));

  res.json({ from, to, upliftPct: UPLIFT_PCT, baseCost, laborCost });
});

/* ================= MONTH ================= */

router.get("/month", (req, res) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Missing date" });

  const month = date.slice(0, 7);

  const rows = db
    .prepare(`SELECT amount FROM labor_entries WHERE substr(date,1,7) = ?`)
    .all(month) as { amount: number }[];

  const baseCost = rows.reduce((s, r) => s + r.amount, 0);
  const laborCost = Number((baseCost * UPLIFT_FACTOR).toFixed(2));

  res.json({ month, upliftPct: UPLIFT_PCT, baseCost, laborCost });
});

/* ================= YEAR ================= */

router.get("/year", (req, res) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Missing date" });

  const year = date.slice(0, 4);

  const rows = db
    .prepare(`SELECT amount FROM labor_entries WHERE substr(date,1,4) = ?`)
    .all(year) as { amount: number }[];

  const baseCost = rows.reduce((s, r) => s + r.amount, 0);
  const laborCost = Number((baseCost * UPLIFT_FACTOR).toFixed(2));

  res.json({ year, upliftPct: UPLIFT_PCT, baseCost, laborCost });
});

/* ================= TODAY SCHEDULE ================= */

router.get("/schedule/today", (req, res) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Missing date" });

  const rows = db
    .prepare(
      `
    SELECT employee, time_from AS "from", time_to AS "to"
    FROM labor_schedule
    WHERE date = ?
    ORDER BY time_from
  `
    )
    .all(date);

  res.json({ date, schedule: rows });
});

export default router;
