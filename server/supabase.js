import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-key";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  PLACEHOLDER_URL;

const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  PLACEHOLDER_KEY;

if (supabaseUrl === PLACEHOLDER_URL || supabaseKey === PLACEHOLDER_KEY) {
  console.warn(
    "⚠️ Supabase credentials not found — running with in-memory fallback. " +
    "Copy .env.example to .env and fill in your project credentials."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export default supabase;
