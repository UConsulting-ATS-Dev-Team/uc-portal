// Shared between PostOpportunityModal.jsx (produces a raw_payload) and
// AdminDashboard.jsx (approves a submission into a real jobs row) so the
// label <-> DB-enum mapping only lives in one place -- keeping it in two
// files risked the two drifting out of sync silently.
export const EMPLOYMENT_TYPE_BY_LABEL = { Internship: "internship", "Full-time": "full_time" };
export const REMOTE_TYPE_BY_WORK_MODE = { Remote: "remote", Hybrid: "hybrid", "In-person": "in_person" };

// Builds a jobs-table insert payload from a member/admin submission's
// raw_payload (data/store.jsx shape, see PostOpportunityModal.jsx).
// Deliberately simple field mapping, not the full normalize/enrich pipeline
// server/src/normalize.ts implements (title->occupation classification,
// compensation regex parsing, etc.) -- that pipeline is designed to run
// server-side (Supabase Edge Functions, not yet deployed); this is enough to
// get an admin-approved submission into a real, queryable job today.
// classification_method is "source_stated" throughout: every field here is
// exactly what the submitter typed, not something the system inferred.
export function buildJobFromSubmission(rawPayload) {
  return {
    company: rawPayload.company,
    title: rawPayload.role,
    employment_type: EMPLOYMENT_TYPE_BY_LABEL[rawPayload.type] ?? null,
    application_url: rawPayload.link,
    description: rawPayload.description || null,
    city: rawPayload.location || null,
    remote_type: REMOTE_TYPE_BY_WORK_MODE[rawPayload.workMode] ?? null,
    compensation_text: rawPayload.comp || null,
    application_deadline: rawPayload.deadline || null,
    graduation_years: (rawPayload.classYears ?? []).map((y) => parseInt(y, 10)).filter((y) => !Number.isNaN(y)),
    relevant_industries: rawPayload.industries ?? [],
    classification_method: "source_stated",
  };
}
