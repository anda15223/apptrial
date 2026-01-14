import { supabase } from "./supabaseClient";

export type DailyInput = {
  date: string; // YYYY-MM-DD
  totalRevenue: number;
  woltRevenue: number;
  laborCost: number;
  bcGroceryCost: number;
  updatedAt: string;
};

export async function upsertDailyInput(
  input: Omit<DailyInput, "updatedAt">
): Promise<DailyInput> {
  const row = {
    date: input.date,
    total_revenue: input.totalRevenue,
    wolt_revenue: input.woltRevenue,
    labor_cost: input.laborCost,
    bc_grocery_cost: input.bcGroceryCost,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("daily_inputs")
    .upsert(row, { onConflict: "date" })
    .select("*")
    .single();

  if (error) throw error;

  return {
    date: data.date,
    totalRevenue: Number(data.total_revenue),
    woltRevenue: Number(data.wolt_revenue),
    laborCost: Number(data.labor_cost),
    bcGroceryCost: Number(data.bc_grocery_cost),
    updatedAt: data.updated_at,
  };
}

export async function listDailyInputs(): Promise<DailyInput[]> {
  const { data, error } = await supabase
    .from("daily_inputs")
    .select("*")
    .order("date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((x) => ({
    date: x.date,
    totalRevenue: Number(x.total_revenue),
    woltRevenue: Number(x.wolt_revenue),
    laborCost: Number(x.labor_cost),
    bcGroceryCost: Number(x.bc_grocery_cost),
    updatedAt: x.updated_at,
  }));
}
