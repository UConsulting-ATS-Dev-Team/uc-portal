import { initialsFromName } from "../data/profileUtils.js";

// Drop-in content for any of the app's `*__avatar` boxes (topbar, avatar
// card, person card, profile header, composer, post card) -- same
// real-photo-with-text-initials-fallback pattern as CompanyLogo.jsx.
// Deliberately doesn't render its own wrapping element: every call site
// already has its own sized/circular `*__avatar` box (button or div) with
// its own className, so this only decides what goes inside it. Matched by
// styles/global.css's shared `[class$="__avatar"] img` rule.
export default function Avatar({ name, url }) {
  return url ? <img src={url} alt="" /> : initialsFromName(name || "?");
}
