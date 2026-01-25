import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// If not configured, do NOT crash the server.
// We allow the backend to run for POS testing without Supabase.
let supabase: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Supabase is disabled."
  );
} else {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
}

export { supabase };
