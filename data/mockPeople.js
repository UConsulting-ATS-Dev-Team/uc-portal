// Small reusable UC member/alumni pool -- used on Job detail's "UC members
// at {company}" card now, and reusable later for Network (1h/1i).
export const PEOPLE = [
  { name: "Sana Liu", classYear: 2019, status: "Alumna", company: "Bain & Company", office: "Chicago", role: "Consultant" },
  { name: "Marcus Webb", classYear: 2021, status: "Alumnus", company: "Bain & Company", office: "Chicago", role: "Senior Associate" },
  { name: "Priya Nair", classYear: 2022, status: "Alumna", company: "McKinsey & Company", office: "New York", role: "Business Analyst" },
  { name: "Andre Ruiz", classYear: 2020, status: "Alumnus", company: "McKinsey & Company", office: "New York", role: "Associate" },
  { name: "Grace Kim", classYear: 2023, status: "Alumna", company: "Deloitte", office: "Chicago", role: "Consultant" },
  { name: "Owen Park", classYear: 2019, status: "Alumnus", company: "Deloitte", office: "Chicago", role: "Manager" },
  { name: "Lena Fischer", classYear: 2022, status: "Alumna", company: "Stripe", office: "San Francisco", role: "Strategy & Ops" },
  { name: "Deepak Shah", classYear: 2021, status: "Alumnus", company: "Goldman Sachs", office: "New York", role: "Associate" },
  { name: "Maya Chen", classYear: 2020, status: "Alumna", company: "BCG", office: "Los Angeles", role: "Consultant" },
  { name: "Julian Osei", classYear: 2023, status: "Alumnus", company: "Accenture", office: "Remote", role: "Analyst" },
];

export function peopleAt(companyName) {
  return PEOPLE.filter((p) => p.company === companyName);
}
