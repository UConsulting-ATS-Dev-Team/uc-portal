// Company directory (wireframe 2b/2c). Open-role counts, UC alumni, and
// past-cycle applicant/offer numbers are computed from data/mockJobs.js
// and data/mockPeople.js rather than hardcoded here, so they can't drift
// out of sync with what's shown on Jobs/Job detail/Network.
//
// careersUrl is each company's own real public careers page -- added for
// pages/CompanyPage.jsx's "no live feed" panel (see its header comment).
// It's the one field on this object that's always real regardless of
// whether the company has automated sourcing: even the mock-only entries
// below get a genuine link-out, never an invented one.
export const COMPANIES = [
  {
    id: "bain",
    name: "Bain & Company",
    logoInitials: "BAIN",
    industry: "Management consulting",
    size: "5k+",
    offices: ["Chicago", "New York", "Los Angeles"],
    recruitingStatus: "Currently hiring",
    characterization: "Broadest UC alumni presence of any firm — the default landing spot for UC's consulting track.",
    description: "UC members most often enter Bain through the Chicago office's summer intern class, usually after at least one prior case-prep cycle with an alumnus coach.",
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
    characterization: "Deep alumni bench in New York — strongest referral network of the MBB firms for UC.",
    description: "McKinsey's UC pipeline runs almost entirely through New York; alumni there actively refer and coach current members through first rounds.",
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
    characterization: "Highest UC offer rate of any firm on the tracker — Human Capital is the most common entry track.",
    description: "UC members typically enter Deloitte through the Human Capital consulting track in Chicago, which recruits earlier in the cycle than most other practices.",
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
    characterization: "Thin UC presence but the strategy & ops track hires from consulting-style backgrounds.",
    description: "Stripe isn't a traditional UC target, but its Strategy & Ops org has taken UC members in past cycles who framed their case-prep skills as structured problem-solving.",
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
    characterization: "UC's primary investment banking pipeline — competitive, but alumni actively refer.",
    description: "UC members entering Goldman almost always go through IBD in New York; alumni there run informal mock-interview sessions ahead of first rounds each fall.",
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
    characterization: "Newer UC pipeline than Bain/McKinsey, but growing fast out of the Los Angeles office.",
    description: "BCG's UC presence is newest of the MBB firms but growing quickly, concentrated in the Los Angeles office where several recent grads now sit.",
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
    characterization: "Limited UC track record so far — worth watching if you want to help build the pipeline.",
    description: "EY-Parthenon has taken very few UC members historically, mostly through the Strategy Spring Week externship rather than direct full-time hiring.",
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
    characterization: "High-volume hirer with a fully remote track — easiest access point, lowest UC differentiation.",
    description: "Accenture hires at much higher volume than the MBB firms, mostly remote; UC members here tend to use it as a fallback rather than a first choice.",
    careersUrl: "https://www.accenture.com/us-en/careers",
  },
];

export function findCompany(id) {
  return COMPANIES.find((c) => c.id === id);
}
