// Core UC member/alumni roster -- used on Network (1h), Member/alumni
// profile (1i), and Job detail's "UC members at {company}" card. These
// are the fictional people behind the app's 8 mock companies (the one
// mock category kept, 2026-09-23 -- see data/mockCompanies.js), so their
// names are deliberately obvious placeholders ("Demo Alum A", etc.)
// rather than realistic-sounding ones -- a name like "Sana Liu" or
// "Marcus Webb" checked clean against the real 209-person Directory
// import at the time, but a coincidental match with a future real member
// was a real, avoidable risk, and an obviously-fake name reinforces the
// "Demo company" badge on the page it appears on instead of undercutting
// it. Profile-page detail (experience, education, contributions, etc.) is
// generated from these core fields by data/peopleUtils.js rather than
// hand-authored per person -- see that file's comment for why.
export const PEOPLE = [
  { id: "sana-liu", name: "Demo Alum A", classYear: 2019, status: "Alumna", company: "Bain & Company", office: "Chicago", role: "Consultant", industry: "Management consulting", location: "Chicago", openToCoffeeChats: true, mutualConnections: 3 },
  { id: "marcus-webb", name: "Demo Alum B", classYear: 2021, status: "Alumnus", company: "Bain & Company", office: "Chicago", role: "Senior Associate", industry: "Management consulting", location: "Chicago", openToCoffeeChats: true, mutualConnections: 5 },
  { id: "priya-nair", name: "Demo Alum C", classYear: 2022, status: "Alumna", company: "McKinsey & Company", office: "New York", role: "Business Analyst", industry: "Management consulting", location: "New York", openToCoffeeChats: true, mutualConnections: 2 },
  { id: "andre-ruiz", name: "Demo Alum D", classYear: 2020, status: "Alumnus", company: "McKinsey & Company", office: "New York", role: "Associate", industry: "Management consulting", location: "New York", openToCoffeeChats: false, mutualConnections: 1 },
  { id: "grace-kim", name: "Demo Alum E", classYear: 2023, status: "Alumna", company: "Deloitte", office: "Chicago", role: "Consultant", industry: "Management consulting", location: "Chicago", openToCoffeeChats: true, mutualConnections: 4 },
  { id: "owen-park", name: "Demo Alum F", classYear: 2019, status: "Alumnus", company: "Deloitte", office: "Chicago", role: "Manager", industry: "Management consulting", location: "Chicago", openToCoffeeChats: false, mutualConnections: 2 },
  { id: "lena-fischer", name: "Demo Alum G", classYear: 2022, status: "Alumna", company: "Stripe", office: "San Francisco", role: "Strategy & Ops", industry: "Tech / product strategy", location: "San Francisco", openToCoffeeChats: true, mutualConnections: 1 },
  { id: "deepak-shah", name: "Demo Alum H", classYear: 2021, status: "Alumnus", company: "Goldman Sachs", office: "New York", role: "Associate", industry: "Investment banking", location: "New York", openToCoffeeChats: true, mutualConnections: 3 },
  { id: "maya-chen", name: "Demo Alum I", classYear: 2020, status: "Alumna", company: "BCG", office: "Los Angeles", role: "Consultant", industry: "Management consulting", location: "Los Angeles", openToCoffeeChats: false, mutualConnections: 2 },
  { id: "julian-osei", name: "Demo Alum J", classYear: 2023, status: "Alumnus", company: "Accenture", office: "Remote", role: "Analyst", industry: "Management consulting", location: "Remote", openToCoffeeChats: true, mutualConnections: 1 },
  { id: "nina-brooks", name: "Demo Member A", classYear: 2029, status: "Current member", company: null, office: null, role: "Sophomore, Recruitment Committee", industry: "Still figuring it out", location: "Los Angeles", openToCoffeeChats: true, mutualConnections: 6 },
  { id: "theo-martins", name: "Demo Member B", classYear: 2027, status: "Current member", company: null, office: null, role: "Junior, Marketing Committee", industry: "Tech / product strategy", location: "Los Angeles", openToCoffeeChats: true, mutualConnections: 4 },
  { id: "isla-reyes", name: "Demo Member C", classYear: 2028, status: "Current member", company: null, office: null, role: "Sophomore, Recruitment Committee", industry: "Investment banking", location: "Los Angeles", openToCoffeeChats: false, mutualConnections: 2 },
];

export function peopleAt(companyName) {
  return PEOPLE.filter((p) => p.company === companyName);
}

export function findPerson(id) {
  return PEOPLE.find((p) => p.id === id);
}
