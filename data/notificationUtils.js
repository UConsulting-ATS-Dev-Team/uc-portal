import { JOBS as MOCK_JOBS } from "./mockJobs.js";
import { daysUntil, isUrgent } from "./jobUtils.js";
import { findPerson } from "./mockPeople.js";
import { relativeTime } from "./feedSync.js";

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// Needs-action notifications are derived from real tracked-application and
// coffee-chat state (deadlines, prep hours, pending chats) rather than
// authored -- same "traceable to something real" principle as the odds
// model. "Earlier this week" used to be a hardcoded illustrative array --
// closes the "Expand general notifications (job postings, deadlines)"
// quick win from the 2026-09-14 MVP-feedback triage by replacing it with
// real content this app already has elsewhere (new matched job postings,
// real feed posts, real unread messages), now that Feed/Messages/real jobs
// are all real rather than mock.
//
// realJobs: optional, defaults to [] -- this is a plain function (not a
// hook), so it can't fetch real jobs itself; pages/Notifications.jsx (the
// only caller) fetches them via data/useRealJobs.js and passes them in.
// Same real-first/mock-fallback lookup as every other trackedJobs consumer
// -- without it, a real tracked job's deadline/prep notifications silently
// never fired. savedJobIds/feedPosts/conversations/currentAccountId are
// the same shape: optional, defaulting to "nothing to show" rather than
// throwing, since not every caller (or every render before its own fetch
// resolves) has them yet.
export function buildNotifications({
  trackedJobs,
  prepLogged,
  coffeeChatStatus,
  realJobs = [],
  savedJobIds = [],
  feedPosts = [],
  conversations = [],
  currentAccountId = null,
}) {
  const needsAction = [];

  Object.entries(trackedJobs).forEach(([jobId, info]) => {
    const job = realJobs.find((j) => j.id === jobId) || MOCK_JOBS.find((j) => j.id === jobId);
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

  // Expansion: a job can have an imminent deadline without being tracked
  // yet -- a member who saved it but never hit "Add to tracker" got no
  // heads-up at all before this. Only for ids not already covered above
  // (trackedJobs), so this can never double up on the same job.
  savedJobIds.forEach((jobId) => {
    if (trackedJobs[jobId]) return;
    const job = realJobs.find((j) => j.id === jobId) || MOCK_JOBS.find((j) => j.id === jobId);
    if (!job || !isUrgent(job)) return;
    const days = daysUntil(job.deadlineDate);
    needsAction.push({
      id: `deadline-${jobId}`,
      category: "Deadlines",
      headline: `${job.company} — ${job.role} closes in ${days} day${days === 1 ? "" : "s"}`,
      detail: "Saved, not yet applied",
      actions: ["View", "Add to tracker"],
      icon: job.logoInitials,
    });
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

  const earlierThisWeek = [];

  // Jobs: a real count of real postings from the last 7 days that this
  // member is eligible for and actually matches on (score > 0) -- reuses
  // the matchScore/matchEligible/postedDaysAgo data/useRealJobs.js already
  // computed for the Jobs board, rather than a second matching pass here.
  const newMatches = realJobs.filter((j) => j.matchEligible && j.matchScore > 0 && j.postedDaysAgo <= 7);
  if (newMatches.length > 0) {
    earlierThisWeek.push({
      id: "jobs-new-matches",
      category: "Jobs",
      headline: `${newMatches.length} new role${newMatches.length === 1 ? "" : "s"} matched your profile this week`,
      source: "Job alert",
      age: "This week",
      href: "/jobs",
    });
  }

  // Announcements: the 3 most recent real feed posts from the last 7 days,
  // excluding this member's own posts (seeing your own post surfaced back
  // at you as a notification isn't useful).
  feedPosts
    .filter((p) => p.author_id !== currentAccountId && (Date.now() - new Date(p.created_at).getTime()) / 86400000 <= 7)
    .slice(0, 3)
    .forEach((p) => {
      earlierThisWeek.push({
        id: `feed-${p.id}`,
        category: "Announcements",
        headline: `${p.author_name} posted on the UC feed: "${truncate(p.body, 60)}"`,
        source: p.post_type,
        age: relativeTime(p.created_at),
        href: "/feed",
      });
    });

  // Network: real unread conversations, most recent first (already sorted
  // that way by data/messagesSync.js's fetchConversations()).
  conversations
    .filter((c) => c.unreadCount > 0)
    .slice(0, 3)
    .forEach((c) => {
      earlierThisWeek.push({
        id: `msg-${c.counterpartId}`,
        category: "Network",
        headline: `${c.counterpartName} sent you a message`,
        source: "Messages",
        age: relativeTime(c.lastMessage.created_at),
        href: `/messages?accountId=${c.counterpartId}`,
      });
    });

  return { needsAction, earlierThisWeek };
}
