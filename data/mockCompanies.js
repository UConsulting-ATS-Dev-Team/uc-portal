// Company directory (wireframe 2b/2c). Open-role counts, UC alumni, and
// applicant/offer numbers are all real now (2026-09-11's fabrication fix --
// see pages/CompanyPage.jsx and data/realCompanies.js's fetchRealCompanyStats/
// liveCharacterization), never computed from this file.
//
// `characterization` used to live here as a static hand-authored sentence
// ("Broadest UC alumni presence of any firm," "Highest UC offer rate of any
// firm on the tracker") -- removed entirely, not just fixed, because a
// static claim about UC's own tracked history can always go stale the
// moment real data changes under it (several already read as directly
// contradicting the real 0s that landed once statsFor() was replaced with
// real stats). data/realCompanies.js's liveCharacterization() generates
// that sentence FROM the same real numbers the stat strip shows instead, so
// it can't drift out of sync again -- same fix, same reasoning, just
// applied to a sentence instead of a number.
//
// `description` stays here as authored context, but rewritten to keep only
// real, publicly-verifiable facts about each company's own org/program
// structure (Human Capital is a real Deloitte practice, IBD is a real
// Goldman division, etc.) -- the parts implying a specific tracked UC
// history ("UC members most often enter...", "alumni there actively
// refer...") are gone, since this app has no real data backing a claim
// like that yet, and now that it shows real data, a paragraph implying
// otherwise would read as false rather than merely thin.
//
// careersUrl is each company's own real public careers page -- the one
// field here that was always real regardless of automated sourcing, even
// before this fix, and unchanged by it.
export const COMPANIES = [
  {
    id: "bain",
    name: "Bain & Company",
    logoInitials: "BAIN",
    industry: "Management consulting",
    size: "5k+",
    offices: ["Chicago", "New York", "Los Angeles"],
    recruitingStatus: "Currently hiring",
    description: "Bain's undergraduate hiring in the US centers on its office-based summer internship program; like other MBB firms, its case-interview process rewards structured, well-rehearsed problem-solving.",
    careersUrl: "https://www.bain.com/careers/",
  },
  {
    id: "mckinsey",
    name: "McKinsey & Company",
    logoInitials: "MCK",
    industry: "Management consulting",
    size: "5k+",
    offices: ["New York", "Chicago"],
    recruitingStatus: "Currently hiring",
    description: "McKinsey recruits through its individual U.S. offices rather than one central pipeline, with New York among its largest; its case-interview process is well-documented across public prep resources.",
    careersUrl: "https://www.mckinsey.com/careers",
  },
  {
    id: "deloitte",
    name: "Deloitte",
    logoInitials: "DEL",
    industry: "Management consulting",
    size: "5k+",
    offices: ["Chicago"],
    recruitingStatus: "Currently hiring",
    description: "Deloitte's Human Capital practice is its people/organizational-strategy consulting track, distinct from its larger audit and tax lines -- often the entry point into consulting-style work there.",
    careersUrl: "https://apply.deloitte.com/en_US/careers/SearchJobs",
  },
  {
    id: "stripe",
    name: "Stripe",
    logoInitials: "STR",
    industry: "Tech / product strategy",
    size: "501-5k",
    offices: ["San Francisco", "Remote"],
    recruitingStatus: "Opens soon",
    description: "Stripe isn't a traditional consulting/IB employer, but its Strategy & Operations org is the closest analog -- a fit for candidates who can frame case-prep-style structured problem-solving as directly relevant.",
    careersUrl: "https://stripe.com/jobs/search",
  },
  {
    id: "goldman-sachs",
    name: "Goldman Sachs",
    logoInitials: "GS",
    industry: "Investment banking",
    size: "5k+",
    offices: ["New York"],
    recruitingStatus: "Currently hiring",
    description: "Goldman's Investment Banking Division (IBD), based primarily in New York, is its most heavily recruited entry-level track for undergraduates targeting IB.",
    careersUrl: "https://www.goldmansachs.com/careers/",
  },
  {
    id: "bcg",
    name: "BCG",
    logoInitials: "BCG",
    industry: "Management consulting",
    size: "5k+",
    offices: ["Los Angeles", "Chicago"],
    recruitingStatus: "Currently hiring",
    description: "BCG is one of the MBB firms, with a Los Angeles office alongside its larger New York and Chicago presence.",
    careersUrl: "https://careers.bcg.com/",
  },
  {
    id: "ey-parthenon",
    name: "EY-Parthenon",
    logoInitials: "EYP",
    industry: "Management consulting",
    size: "501-5k",
    offices: ["Chicago"],
    recruitingStatus: "Closed for cycle",
    description: "EY-Parthenon is EY's dedicated strategy-consulting arm; its Strategy Spring Week is a well-known early-exposure externship many students use to explore the practice ahead of a full-time process.",
    careersUrl: "https://www.ey.com/en_us/careers",
  },
  {
    id: "accenture",
    name: "Accenture",
    logoInitials: "ACN",
    industry: "Management consulting",
    size: "5k+",
    offices: ["Remote"],
    recruitingStatus: "Currently hiring",
    description: "Accenture is one of the largest consulting employers by headcount, with hiring volume far exceeding the MBB firms and a substantial share of roles offered remote.",
    careersUrl: "https://www.accenture.com/us-en/careers",
  },
];

export function findCompany(id) {
  return COMPANIES.find((c) => c.id === id);
}
