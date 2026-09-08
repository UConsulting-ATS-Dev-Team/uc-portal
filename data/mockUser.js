// Prototype-only mock state — no backend, no real auth.
// Flip `role` to "exec" or "careers-committee" to see the Leadership nav section.
export const currentUser = {
  firstName: "Jordan",
  lastName: "Ellis",
  initials: "JE",
  classYear: 2027,
  majors: "Business Economics, Data Science",
  ucCommittee: "Recruitment Committee",
  role: "member", // "member" | "alumnus" | "exec" | "careers-committee"
};

export const navCounts = {
  applications: 5,
  notificationsUnread: 4,
};

// members is a real, exact count (hand-counted from the club directory
// Google Sheet, Sept 2026: 52 -- only 3 active class years right now,
// since the graduating seniors just left and the new freshman class
// hasn't been onboarded yet, see data/mockAdmin.js's CLASS_YEAR_BREAKDOWN
// for the same 3-year split). alumni stays an approximate "+" floor per
// the club website -- there's no membership-roster backend to compute an
// exact historical alumni count from, and nobody's counted it by hand.
export const clubStats = {
  members: 52,
  alumni: "150+",
};
