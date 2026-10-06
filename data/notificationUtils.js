import { daysUntil, isUrgent } from "./jobUtils.js";
import { relativeTime } from "./feedSync.js";
import { NEUTRAL_FILTERS, matchesFilters } from "./jobFilters.js";
import { isNewSince } from "./jobVisit.js";

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
  // realJobs is only what is still open; knownJobs additionally holds the
  // member's own tracked/saved jobs that have since closed. Defaults to
  // realJobs so a caller that doesn't pass it behaves exactly as before.
  knownJobs = realJobs,
  savedJobIds = [],
  feedPosts = [],
  conversations = [],
  currentAccountId = null,
  people = [],
  // Roles the board first listed after this moment (epoch ms) are "new" (data/jobVisit.js); null until known.
  visitBaseline = null,
  followedCompanies = [],
  savedSearches = [],
  // The member's "New matched jobs" notification setting.
  jobAlertsEnabled = true,
}) {
  const needsAction = [];

  Object.entries(trackedJobs).forEach(([jobId, info]) => {
    const job = knownJobs.find((j) => j.id === jobId);
    if (!job || info.stage === "Closed") return;

    // A closed posting has no deadline left to act on, so no deadline
    // reminder -- but the prep reminder below stays: interviews routinely
    // continue after the employer takes the posting down.
    if (!job.closed && isUrgent(job)) {
      const days = daysUntil(job.deadlineDate);
      needsAction.push({
        id: `deadline-${jobId}`,
        category: "Deadlines",
        headline: `${job.role} at ${job.company} closes in ${days} day${days === 1 ? "" : "s"}`,
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
          headline: `${job.company} ${info.stage.toLowerCase()} is coming up. You're at ${hours} of 26 median prep hours`,
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
    const job = knownJobs.find((j) => j.id === jobId);
    if (!job || job.closed || !isUrgent(job)) return;
    const days = daysUntil(job.deadlineDate);
    needsAction.push({
      id: `deadline-${jobId}`,
      category: "Deadlines",
      headline: `${job.role} at ${job.company} closes in ${days} day${days === 1 ? "" : "s"}`,
      detail: "Saved, not yet applied",
      actions: ["View", "Add to tracker"],
      icon: job.logoInitials,
    });
  });

  Object.entries(coffeeChatStatus).forEach(([personId, status]) => {
    if (status === "Confirmed" || status.startsWith("Confirmed")) return; // already resolved
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    needsAction.push({
      id: `chat-${personId}`,
      category: "Network",
      headline: `Coffee chat with ${person.name}: ${status.toLowerCase()}`,
      detail: `${person.role} · ${person.company || "UC"}`,
      actions: status === "Follow-up due" ? ["Follow up", "Snooze"] : ["Confirm", "Reschedule"],
      icon: person.name.split(" ").map((p) => p[0]).join(""),
    });
  });

  const earlierThisWeek = [];

  // Job alerts: roles the board listed since the member's last visit that they are eligible for. Three
  // views of the same set: at a company they follow, a strong match for their profile (the Recommended
  // tab's 70% bar), and new results for each of their saved searches. All derived from data already
  // loaded (data/useRealJobs.js), so nothing is sent anywhere and no email goes out.
  if (jobAlertsEnabled && visitBaseline != null) {
    const fresh = realJobs.filter((j) => j.matchEligible && isNewSince(j, visitBaseline));
    const plural = (n) => `role${n === 1 ? "" : "s"}`;

    const atFollowed = fresh.filter((j) => followedCompanies.includes(j.company));
    if (atFollowed.length > 0) {
      const names = [...new Set(atFollowed.map((j) => j.company))];
      earlierThisWeek.push({
        id: "jobs-new-followed",
        category: "Jobs",
        headline: `${atFollowed.length} new ${plural(atFollowed.length)} at ${names.length === 1 ? names[0] : `${names.length} companies you follow`}`,
        source: "Job alert",
        age: "Since your last visit",
        href: "/jobs?tab=new",
      });
    }

    const matched = fresh.filter((j) => j.matchScore >= 70);
    if (matched.length > 0) {
      earlierThisWeek.push({
        id: "jobs-new-matches",
        category: "Jobs",
        headline: `${matched.length} new ${plural(matched.length)} matched your profile`,
        source: "Job alert",
        age: "Since your last visit",
        href: "/jobs?tab=new",
      });
    }

    savedSearches.forEach((search) => {
      const filters = { ...NEUTRAL_FILTERS, ...search.filters };
      const hits = fresh.filter((j) => matchesFilters(j, filters)).length;
      if (hits === 0) return;
      earlierThisWeek.push({
        id: `jobs-new-search-${search.id}`,
        category: "Jobs",
        headline: `${hits} new ${plural(hits)} for your saved search "${truncate(search.label, 50)}"`,
        source: "Job alert",
        age: "Since your last visit",
        href: `/jobs?savedSearch=${encodeURIComponent(search.id)}`,
      });
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
