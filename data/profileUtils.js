// Shared with pages/MyProfile.jsx (2g) and pages/Home.jsx (1a) -- both
// need the same "profile strength" computation, so it lives here once
// rather than being duplicated.

// Real name overrides live in store.jsx's profileOverrides.fullName once a
// member has actually saved a change on My Profile's Personal tab -- falls
// back to the mock currentUser identity otherwise. Every avatar across the
// app (TopBar, Home, Feed, My Profile) should read through this rather than
// currentUser directly, so a saved name change is reflected everywhere
// consistently instead of only on the page where it was edited.
export function displayName(currentUser, profileOverrides) {
  return profileOverrides?.fullName?.trim() || `${currentUser.firstName} ${currentUser.lastName}`;
}

// Same fallback pattern as displayName() above, for the other three
// Personal-tab fields that can now be overridden (My Profile's
// handleSaveChanges) but are still read directly off the mock currentUser
// in several functional (not just display) call sites -- real job matching
// (data/jobMatch.js's matchJob(), used by both Jobs.jsx and
// RealJobDetail.jsx) takes a member's class year as a hard constraint, so a
// saved grad-year change needs to actually reach it, not just redraw text.
export function resolvedClassYear(currentUser, profileOverrides) {
  return profileOverrides?.classYear ?? currentUser.classYear;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Real ask: not everyone graduates in June, and how far a member actually
// is from graduating can affect which roles make sense to recommend.
// Unlike resolvedClassYear, there's no mock currentUser.gradMonth fallback
// -- class_year already had an established (if fake) mock default;
// gradMonth is new, so "not set yet" is the honest, correct default for
// every real member until they fill it in on My Profile, not an invented
// one.
export function resolvedGradMonth(currentUser, profileOverrides) {
  return profileOverrides?.gradMonth ?? null;
}

// How many whole calendar months from `now` until the 1st of gradMonth in
// classYear -- null (meaning "unknown, don't apply this as a scoring
// factor") whenever either half is missing, rather than guessing June.
// Used by data/jobMatch.js's matchJob() as a soft timing signal between
// internship vs. full-time listings; real job postings never state a
// graduation MONTH requirement (only graduation_years), so this can only
// ever inform a soft preference, not a hard eligibility gate.
export function monthsUntilGraduation(classYear, gradMonth, now = new Date()) {
  if (!classYear || !gradMonth) return null;
  const gradDate = new Date(classYear, gradMonth - 1, 1);
  return (gradDate.getFullYear() - now.getFullYear()) * 12 + (gradDate.getMonth() - now.getMonth());
}

export function resolvedMajors(currentUser, profileOverrides) {
  return profileOverrides?.majors || currentUser.majors;
}

export function resolvedUcCommittee(currentUser, profileOverrides) {
  return profileOverrides?.ucCommittee || currentUser.ucCommittee;
}

export function initialsFromName(fullName) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("");
}
// hasResume is passed in (profileOverrides.resumePath, truthy-checked)
// rather than read off preferences.resumeAttached, a separate boolean two
// different fake "upload" entry points (Onboarding, My Profile) used to
// toggle independently, never actually tied to a real file. Now there's
// one real upload path (data/resumeSync.js) and one real signal.
export function computeProfileStrength(preferences, linkedIn, hasResume) {
  const checks = [
    { label: "Resume attached", done: !!hasResume },
    { label: "Target industries selected", done: preferences.industries.length > 0 },
    { label: "Target roles selected", done: preferences.roles.length > 0 },
    { label: "Target locations selected", done: preferences.locations.length > 0 },
    { label: "LinkedIn added", done: !!linkedIn },
    { label: "Companies of interest followed", done: preferences.followedCompanies.length > 0 },
    { label: "Recruiting timeline set", done: !!preferences.recruitingCycle },
  ];
  const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
  return { checks, pct };
}
