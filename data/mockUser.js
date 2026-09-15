// Prototype-only mock state, used as a display-copy fallback until a real
// signed-in member's own profile overrides it. `role` here is NOT what
// gates the Leadership nav section (that's the real profiles.role column,
// only "member"/"admin" -- see data/store.jsx's isAdmin and
// components/NavRail.jsx); it's leftover from before real auth existed,
// unused for access control now.
export const currentUser = {
  firstName: "Test",
  lastName: "Account",
  initials: "TA",
  classYear: 2027,
  majors: "Business Economics, Data Science",
  ucCommittee: "Recruitment Committee",
  role: "member",
};

// members is a real, exact count, read directly from the real `people`
// table's own Current-member rows (2026-09-15). Was 67 (2026-09-14, from
// the Directory sheet's Active tab at that time) -- corrected down to 52
// the next day once 15 of those 67 were confirmed to have actually
// graduated since (see the dated Progress entry below for the
// reclassification) and moved to Alumni status. Worth re-checking the
// real `people` table's Current-member count again before this goes to
// production if much time passes, rather than trusting this hardcoded
// number indefinitely. alumni stays an approximate "+" floor per the
// club website -- there's no membership-roster backend to compute an
// exact historical alumni count from, and nobody's counted it by hand.
export const clubStats = {
  members: 52,
  alumni: "150+",
};
