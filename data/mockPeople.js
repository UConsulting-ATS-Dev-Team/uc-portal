// Core UC member/alumni roster -- used on Network (1h), Member/alumni
// profile (1i), and Job detail's "UC members at {company}" card.
// Profile-page detail (experience, education, contributions, etc.) is
// generated from these core fields by data/peopleUtils.js rather than
// hand-authored per person -- see that file's comment for why.
export const PEOPLE = [
  { id: "sana-liu", name: "Sana Liu", classYear: 2019, status: "Alumna", company: "Bain & Company", office: "Chicago", role: "Consultant", industry: "Management consulting", location: "Chicago", openToCoffeeChats: true, mutualConnections: 3 },
  { id: "marcus-webb", name: "Marcus Webb", classYear: 2021, status: "Alumnus", company: "Bain & Company", office: "Chicago", role: "Senior Associate", industry: "Management consulting", location: "Chicago", openToCoffeeChats: true, mutualConnections: 5 },
  { id: "priya-nair", name: "Priya Nair", classYear: 2022, status: "Alumna", company: "McKinsey & Company", office: "New York", role: "Business Analyst", industry: "Management consulting", location: "New York", openToCoffeeChats: true, mutualConnections: 2 },
  { id: "andre-ruiz", name: "Andre Ruiz", classYear: 2020, status: "Alumnus", company: "McKinsey & Company", office: "New York", role: "Associate", industry: "Management consulting", location: "New York", openToCoffeeChats: false, mutualConnections: 1 },
  { id: "grace-kim", name: "Grace Kim", classYear: 2023, status: "Alumna", company: "Deloitte", office: "Chicago", role: "Consultant", industry: "Management consulting", location: "Chicago", openToCoffeeChats: true, mutualConnections: 4 },
  { id: "owen-park", name: "Owen Park", classYear: 2019, status: "Alumnus", company: "Deloitte", office: "Chicago", role: "Manager", industry: "Management consulting", location: "Chicago", openToCoffeeChats: false, mutualConnections: 2 },
  { id: "lena-fischer", name: "Lena Fischer", classYear: 2022, status: "Alumna", company: "Stripe", office: "San Francisco", role: "Strategy & Ops", industry: "Tech / product strategy", location: "San Francisco", openToCoffeeChats: true, mutualConnections: 1 },
  { id: "deepak-shah", name: "Deepak Shah", classYear: 2021, status: "Alumnus", company: "Goldman Sachs", office: "New York", role: "Associate", industry: "Investment banking", location: "New York", openToCoffeeChats: true, mutualConnections: 3 },
  { id: "maya-chen", name: "Maya Chen", classYear: 2020, status: "Alumna", company: "BCG", office: "Los Angeles", role: "Consultant", industry: "Management consulting", location: "Los Angeles", openToCoffeeChats: false, mutualConnections: 2 },
  { id: "julian-osei", name: "Julian Osei", classYear: 2023, status: "Alumnus", company: "Accenture", office: "Remote", role: "Analyst", industry: "Management consulting", location: "Remote", openToCoffeeChats: true, mutualConnections: 1 },
  { id: "nina-brooks", name: "Nina Brooks", classYear: 2029, status: "Current member", company: null, office: null, role: "Sophomore, Careers Committee", industry: "Still figuring it out", location: "Los Angeles", openToCoffeeChats: true, mutualConnections: 6 },
  { id: "theo-martins", name: "Theo Martins", classYear: 2027, status: "Current member", company: null, office: null, role: "Junior, Marketing Committee", industry: "Tech / product strategy", location: "Los Angeles", openToCoffeeChats: true, mutualConnections: 4 },
  { id: "isla-reyes", name: "Isla Reyes", classYear: 2028, status: "Current member", company: null, office: null, role: "Sophomore, Recruitment Committee", industry: "Investment banking", location: "Los Angeles", openToCoffeeChats: false, mutualConnections: 2 },
];

export function peopleAt(companyName) {
  return PEOPLE.filter((p) => p.company === companyName);
}

export function findPerson(id) {
  return PEOPLE.find((p) => p.id === id);
}
