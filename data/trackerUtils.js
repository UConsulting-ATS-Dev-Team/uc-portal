// Shared stage taxonomy for the Applications tracker (1f/1g/1j). All three
// views read the same records, keyed by this exact list.
export const STAGES = ["Interested", "Preparing", "Applied", "Assessment", "First round", "Final round", "Closed"];

export const INTERVIEW_STAGES = ["First round", "Final round"];

export function nextActionForStage(stage) {
  switch (stage) {
    case "Interested":
      return "Decide whether to apply";
    case "Preparing":
      return "Log prep time";
    case "Applied":
      return "Follow up";
    case "Assessment":
      return "Complete assessment";
    case "First round":
      return "Prep for interview";
    case "Final round":
      return "Await decision";
    default:
      return "—";
  }
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Real outcome recorded on a Closed application -- see migration
// 20260902130000_tracked_application_outcome.sql for why "Closed" alone
// was ambiguous (offer-and-accepted, rejected, withdrawn, and ghosted all
// looked identical) and the reasoning behind these four exact values.
// `outcome` on a trackedJobs record is `null`/`undefined` for "not
// recorded yet" -- every application that reached Closed before this
// feature existed, and any new one a member skips annotating, is exactly
// that case, not a fifth "no outcome" value.
export const OUTCOMES = [
  { key: "offer", label: "Got an offer" },
  { key: "rejected", label: "Rejected" },
  { key: "withdrew", label: "Withdrew" },
  { key: "no_response", label: "No response" },
];

export function outcomeLabel(outcome) {
  return OUTCOMES.find((o) => o.key === outcome)?.label ?? null;
}
