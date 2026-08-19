// Shared with pages/MyProfile.jsx (2g) and pages/Home.jsx (1a) -- both
// need the same "profile strength" computation, so it lives here once
// rather than being duplicated.
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
