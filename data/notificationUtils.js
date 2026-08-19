import { JOBS } from "./mockJobs.js";
import { daysUntil, isUrgent } from "./jobUtils.js";
import { findPerson } from "./mockPeople.js";

// Needs-action notifications are derived from real tracked-application and
// coffee-chat state (deadlines, prep hours, pending chats) rather than
// authored -- same "traceable to something real" principle as the odds
// model. "Earlier this week" is a smaller set of lower-stakes items
// (feed/announcement flavor) that don't have an obvious live data source
// yet, so those stay illustrative.
export function buildNotifications({ trackedJobs, prepLogged, coffeeChatStatus }) {
  const needsAction = [];

  Object.entries(trackedJobs).forEach(([jobId, info]) => {
    const job = JOBS.find((j) => j.id === jobId);
    if (!job || info.stage === "Closed") return;

    if (isUrgent(job)) {
      const days = daysUntil(job.deadlineDate);
      needsAction.push({
        id: `deadline-${jobId}`,
        category: "Deadlines",
        headline: `${job.company} — ${job.role} closes in ${days} day${days === 1 ? "" : "s"}`,
        detail: `Applications tracker · ${info.stage}`,
        actions: ["Apply", "Snooze"],
        icon: job.logoInitials,
      });
    }

    if (["First round", "Final round"].includes(info.stage)) {
      const hours = prepLogged[jobId] || 0;
      const days = daysUntil(job.deadlineDate);
      if (hours < 26) {
        needsAction.push({
          id: `prep-${jobId}`,
          category: "Deadlines",
          headline: `${job.company} ${info.stage.toLowerCase()} is coming up — you're at ${hours} of 26 median prep hours`,
          detail: days !== null ? `${Math.max(days, 0)} days out` : "Prep before your interview",
          actions: ["Prep now"],
          icon: job.logoInitials,
        });
      }
    }
  });

  Object.entries(coffeeChatStatus).forEach(([personId, status]) => {
    if (status === "Confirmed" || status.startsWith("Confirmed")) return; // already resolved
    const person = findPerson(personId);
    if (!person) return;
    needsAction.push({
      id: `chat-${personId}`,
      category: "Network",
      headline: `${person.name} — coffee chat ${status.toLowerCase()}`,
      detail: `${person.role} · ${person.company || "UC"}`,
      actions: status === "Follow-up due" ? ["Follow up", "Snooze"] : ["Confirm", "Reschedule"],
      icon: person.name.split(" ").map((p) => p[0]).join(""),
    });
  });

  const earlierThisWeek = [
    { id: "e1", category: "Announcements", headline: "Sana Liu posted an interview write-up for Bain & Company", source: "Feed", age: "2d" },
    { id: "e2", category: "Jobs", headline: "3 new roles matched your profile this week", source: "Job alert", age: "3d" },
    { id: "e3", category: "Announcements", headline: "Case Workshop #2 registration is open", source: "UC announcement", age: "3d" },
    { id: "e4", category: "Network", headline: "Marcus Webb replied to your message", source: "Alumni update", age: "1w" },
  ];

  return { needsAction, earlierThisWeek };
}
