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

// A bare "Rejected" was too coarse -- see migration
// 20260908_tracked_application_rejection_stage.sql for the full
// reasoning. Five values, matching the tracker's own real stage taxonomy
// above rather than a separately-invented scale, so "where it ended" is
// always describable in the app's own vocabulary.
export const REJECTION_STAGES = [
  { key: "application", label: "Resume / application screen" },
  { key: "assessment", label: "After an assessment" },
  { key: "first_round", label: "After a first-round interview" },
  { key: "final_round", label: "After a final round" },
  { key: "other", label: "Other / not sure" },
];

export function rejectionStageLabel(rejectionStage) {
  return REJECTION_STAGES.find((r) => r.key === rejectionStage)?.label ?? null;
}

// Suggests (never silently assumes) a rejection stage from the
// application's own real stageHistory -- the tracker stage it was in
// right before moving to Closed already answers "where did it end?" for
// most cases, so asking a member to re-type information the app already
// has would be redundant. Still just a pre-selected suggestion in
// RecordOutcomeModal.jsx, not auto-saved -- a member can always correct
// it (e.g. genuinely rejected at the application stage despite having
// briefly viewed a later stage for some other reason).
export function suggestRejectionStage(stageHistory) {
  if (!stageHistory?.length) return null;
  const priorStages = stageHistory.filter((h) => h.stage !== "Closed").map((h) => h.stage);
  const lastRealStage = priorStages[priorStages.length - 1];
  switch (lastRealStage) {
    case "Assessment":
      return "assessment";
    case "First round":
      return "first_round";
    case "Final round":
      return "final_round";
    case "Applied":
    case "Preparing":
    case "Interested":
      return "application";
    default:
      return null;
  }
}
