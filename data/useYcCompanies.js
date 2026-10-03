import { useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient.js";

// Which companies Y Combinator backed: company name (exactly as jobs.company carries it) -> short batch like "W12".
// A small public reference table (company_yc, ~100 rows), loaded once per page load and shared by every component
// that shows or filters on it, so a board of 25 job cards makes one request, not 25.
const EMPTY = new Map();
let snapshot = EMPTY;
let started = false;
const listeners = new Set();

function start() {
  if (started) return;
  started = true;
  supabase
    .from("company_yc")
    .select("company_name, yc_batch")
    .then(({ data, error }) => {
      if (error) return; // no badges, nothing else breaks
      snapshot = new Map((data ?? []).map((r) => [r.company_name, r.yc_batch]));
      listeners.forEach((l) => l());
    })
    .catch(() => {});
}

function subscribe(listener) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Map of company name -> batch ("W12", "S19", "X25"); empty until loaded or if the lookup failed.
export function useYcCompanies() {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

// "W12" -> "Winter 2012"
export function ycBatchLabel(batch) {
  const season = { W: "Winter", S: "Summer", X: "Spring", F: "Fall" }[batch?.[0]];
  return season ? `${season} 20${batch.slice(1)}` : batch;
}
