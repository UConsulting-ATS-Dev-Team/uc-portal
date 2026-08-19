import { COMPANY_LOGOS } from "../data/companyLogos.js";

// Drop-in replacement for the old bare `{logoInitials}` badge -- renders the
// real company logo when we have one, falling back to the text-initials
// badge (same className, so all the existing __logo box CSS still applies).
export default function CompanyLogo({ name, initials, className }) {
  const src = COMPANY_LOGOS[name];
  return <div className={className}>{src ? <img src={src} alt={`${name} logo`} /> : initials}</div>;
}
