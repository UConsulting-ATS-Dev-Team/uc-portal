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

export function initialsFromName(fullName) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("");
}
export function computeProfileStrength(preferences, linkedIn) {
  const checks = [
    { label: "Resume attached", done: preferences.resumeAttached },
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
