// Free certifications (static reference list -- real providers, real URLs).
// Real certifications, real providers, real URLs -- verified live
// before adding (titles/providers corrected to match the actual real
// course, not guessed): direct ask ("find real certifications... and
// clicking should actually take the user to the said certification").
// The CFI entry's original title ("Financial Modeling Fundamentals")
// didn't match any real CFI course -- CFI's actual free-preview course
// in this space is "Introduction to 3-Statement Financial Modeling,"
// used here instead. The UC-internal "AI Tools for Case Prep" entry
// (not a real third-party certification, no real external URL to send
// anyone to) was dropped rather than faked.
export const CERTIFICATIONS = [
  { id: "coursera-excel", title: "Excel Skills for Business", provider: "Coursera (Macquarie University, audit free)", cost: "Free", hours: 20, countsFor: ["Excel, SQL & Finance Fundamentals"], skillCategory: "Excel & modeling", url: "https://www.coursera.org/specializations/excel" },
  { id: "google-data", title: "Google Data Analytics Professional Certificate", provider: "Google (via Coursera)", cost: "Free 7-day trial, then paid", hours: 40, countsFor: [], skillCategory: "SQL & data", url: "https://www.coursera.org/professional-certificates/google-data-analytics" },
  { id: "cfi-modeling", title: "Introduction to 3-Statement Financial Modeling", provider: "Corporate Finance Institute (free preview)", cost: "Free", hours: 15, countsFor: ["Excel, SQL & Finance Fundamentals"], skillCategory: "Excel & modeling", url: "https://corporatefinanceinstitute.com/course/intro-3-statement-modeling/" },
  { id: "mode-sql", title: "SQL Tutorial", provider: "Mode Analytics", cost: "Free", hours: 8, countsFor: ["Excel, SQL & Finance Fundamentals"], skillCategory: "SQL & data", url: "https://mode.com/sql-tutorial/" },
];
