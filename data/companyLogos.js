import bain from "../assets/bain.svg";
import mckinsey from "../assets/mckinsey.svg";
import deloitte from "../assets/deloitte.svg";
import stripe from "../assets/stripe.svg";
import goldmanSachs from "../assets/goldman-sachs.svg";
import bcg from "../assets/bcg.svg";
import eyParthenon from "../assets/ey-parthenon.svg";
import accenture from "../assets/accenture.svg";

// Real logos for the 8 companies in mockJobs.js/mockCompanies.js, sourced
// from each company's own Wikimedia Commons file page (via Wikidata's P154
// logo-image claim) -- not scraped from Handshake/LinkedIn/etc, just public
// reference logos used the same way any article or press mention would.
// Any company name not in this map (e.g. a member-submitted opportunity)
// falls back to the existing text-initials badge in CompanyLogo.jsx.
export const COMPANY_LOGOS = {
  "Bain & Company": bain,
  "McKinsey & Company": mckinsey,
  Deloitte: deloitte,
  Stripe: stripe,
  "Goldman Sachs": goldmanSachs,
  BCG: bcg,
  "EY-Parthenon": eyParthenon,
  Accenture: accenture,
};
