import fs from "node:fs";
import path from "node:path";

export type DailyInput = {
  date: string; // YYYY-MM-DD
  totalRevenue: number;
  woltRevenue: number;
  laborCost: number; // manual now, Planday later
  bcGroceryCost: number; // manual now, BC later
  updatedAt: string;
};

type DbShape = {
  dailyInputs: DailyInput[];
};

const DB_PATH = path.join(process.cwd(), "data", "db.json");

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    const init: DbShape = { dailyInputs: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), "utf-8");
  }
}

export function readDb(): DbShape {
  ensureDbFile();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as DbShape;
}

export function writeDb(db: DbShape) {
  ensureDbFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function upsertDailyInput(input: Omit<DailyInput, "updatedAt">): DailyInput {
  const db = readDb();
  const updated: DailyInput = { ...input, updatedAt: new Date().toISOString() };

  const idx = db.dailyInputs.findIndex((x) => x.date === input.date);
  if (idx >= 0) db.dailyInputs[idx] = updated;
  else db.dailyInputs.push(updated);

  db.dailyInputs.sort((a, b) => a.date.localeCompare(b.date));
  writeDb(db);

  return updated;
}

export function listDailyInputs(): DailyInput[] {
  return readDb().dailyInputs;
}
