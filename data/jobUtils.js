// Anti-domination cap: one company (e.g. Databricks/Carvana with hundreds+
// of real postings) shouldn't fill an entire list of cards. Used to be one
// flat number (3) here, read by pages/Jobs.jsx's whole-array
// capPerCompany() -- 2026-09-09's company-tier work (see
// data/companyTiers.js and supabase/migrations/20260909070000_company_tiers.sql)
// replaced the flat cap with a per-company one driven by how relevant that
// company actually is to UC, so this constant is gone; capPerCompany() now
// takes a resolver function instead of one shared number.

// Deadline math shared by the Jobs board's filter and its job cards.
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr) - new Date();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(job) {
  if (job.rolling) return "Rolling";
  const days = daysUntil(job.deadlineDate);
  if (days === null) return "No deadline listed";
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days <= 14) return `${days}d left`;
  return new Date(job.deadlineDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isUrgent(job) {
  if (job.rolling) return false;
  const days = daysUntil(job.deadlineDate);
  return days !== null && days >= 0 && days <= 7;
}

export function matchesDeadlineBucket(job, bucket) {
  if (bucket === "Rolling") return !!job.rolling;
  const days = daysUntil(job.deadlineDate);
  if (days === null || days < 0) return false;
  if (bucket === "This week") return days <= 7;
  if (bucket === "This month") return days <= 30;
  return false;
}
