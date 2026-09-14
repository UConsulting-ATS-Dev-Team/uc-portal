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

// members is a real, exact count -- read directly from the real
// "UConsulting Directory" Google Sheet's own Active-status rows (2026-09-14,
// the same read used to seed the real roster table -- 67 unique people,
// see 20260914010000_seed_roster_from_directory.sql), not hand-typed.
// Previously 52 (Sept 2026); the difference is a new admitted class
// (several real people in the sheet show Admit Class "Winter 2026") that
// hadn't joined yet when 52 was last counted. Worth re-reading the sheet
// again before this goes to production if much time passes. alumni stays
// an approximate "+" floor per the club website -- there's no
// membership-roster backend to compute an exact historical alumni count
// from, and nobody's counted it by hand.
export const clubStats = {
  members: 67,
  alumni: "150+",
};
