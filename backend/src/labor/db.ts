import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "labor.db");

console.log("📁 Labor DB path:", dbPath);

export const db = new Database(dbPath);

// Initialize tables (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS labor_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_labor_entries_date
    ON labor_entries(date);

  CREATE INDEX IF NOT EXISTS idx_labor_entries_employee
    ON labor_entries(employee);
`);
