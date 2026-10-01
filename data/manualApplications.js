// Shared by every place that resolves a trackedJobs entry against real/
// mock jobs (Applications.jsx, Home.jsx, etc.) -- a third fallback tier
// for an application added via Add Application's "Paste a link"/"Enter
// manually" tabs, which have no real jobs row at all. Builds a job-shaped
// object with only the fields a manual entry can ever honestly have
// (company, role, an optional external URL) -- no odds model, no UC
// recruiting intelligence, no match score, since none of that exists for
// a posting outside this app's own job board.
export const MANUAL_JOB_ID_PREFIX = "manual-";

export function isManualJobId(jobId) {
  return typeof jobId === "string" && jobId.startsWith(MANUAL_JOB_ID_PREFIX);
}

export function jobForManualEntry(jobId, info) {
  const company = info?.manualCompany || "Unknown company";
  return {
    id: jobId,
    company,
    role: info?.manualRole || "Untitled role",
    logoInitials: company.slice(0, 3).toUpperCase(),
    applicationUrl: info?.manualUrl || null,
    isManual: true,
    rolling: true, // unknown real deadline -- "Rolling" reads better than "No deadline listed"
  };
}
