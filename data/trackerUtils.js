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
