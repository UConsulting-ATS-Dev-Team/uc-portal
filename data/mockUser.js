// Prototype-only mock state — no backend, no real auth.
// Flip `role` to "exec" or "careers-committee" to see the Leadership nav section.
export const currentUser = {
  firstName: "Jordan",
  lastName: "Ellis",
  initials: "JE",
  classYear: 2027,
  role: "member", // "member" | "alumnus" | "exec" | "careers-committee"
};

export const navCounts = {
  applications: 5,
  notificationsUnread: 4,
};

export const clubStats = {
  members: 142,
  alumni: 380,
  tagline: "invite only",
};
