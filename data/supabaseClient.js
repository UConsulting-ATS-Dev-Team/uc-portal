import { createClient } from "@supabase/supabase-js";

// Single shared client for the whole app, per Supabase's own recommendation
// (one client instance, reused everywhere, not re-created per component).
// Reads from .env (gitignored) via Vite's import.meta.env -- see
// .env.example for what's needed. The anon key is safe to ship in frontend
// code; it's the public/publishable key meant for exactly this, access is
// controlled by the database's Row Level Security policies, not by keeping
// this key secret.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values (Project Settings > API)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
