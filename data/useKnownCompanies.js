import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { COMPANIES } from "./careerOptions.js";

// Names a member can follow as a company of interest: the 8 hand-curated ones plus every company the job
// pipeline actually tracks (company_tiers, ~160 rows, readable by any signed-in member). These are the exact
// strings jobs carry in `company`, which is what a followed company is matched against -- so picking from this
// list works, where a free-typed name only matched if the member spelled it exactly like the employer's board.
let cache = null;

async function loadTrackedCompanyNames() {
  if (cache) return cache;
  const { data, error } = await supabase.from("company_tiers").select("company_name");
  if (error) throw new Error(`Fetching tracked companies failed: ${error.message}`);
  cache = (data ?? []).map((r) => r.company_name);
  return cache;
}

export function useKnownCompanies() {
  const [tracked, setTracked] = useState(cache ?? []);

  useEffect(() => {
    let cancelled = false;
    loadTrackedCompanyNames()
      .then((names) => !cancelled && setTracked(names))
      .catch(() => {}); // falls back to the curated list alone
    return () => {
      cancelled = true;
    };
  }, []);

  const names = new Set(COMPANIES.map((c) => c.name));
  tracked.forEach((n) => names.add(n));
  return [...names].sort((a, b) => a.localeCompare(b));
}
