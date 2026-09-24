// Admin Dashboard (2h) remaining illustrative figures. The KPI strip,
// "Where members want to work," "Class-year breakdown," and "Most
// targeted companies" sections were removed (2026-09-23, direct
// instruction to trim mock content down to a couple of clearly-labeled
// things rather than scattered fake numbers across the app) -- those were
// club-wide survey/analytics figures no browser session could really
// compute, estimated rather than derived from real signups. What's left
// here has no real equivalent data source yet either, but is small/scoped
// enough to keep labeled "Illustrative" rather than remove outright.
export const ACCESS_CONTROL = {
  provisioned: "Roster-provisioned",
  // Was "Auto-converts to alumni at commencement" -- false, and directly
  // contradicted by real behavior: nothing has ever auto-converted anyone
  // (see the alumni-accounts migration's own writeup in CLAUDE.md). A
  // member's real member_status only ever changes via can_sign_up()'s
  // real Directory-alumni-match at signup, or an admin's own action --
  // never automatically at any later point. Corrected to state the real
  // mechanism, matching the wording SignIn.jsx's own footer note uses.
  accessMechanism: "New accounts: roster match (current members) or a real Directory alumni match (alumni) at signup.",
  pendingRemovals: 3,
};

export const FLAGGED_FEED_POSTS = 2;
