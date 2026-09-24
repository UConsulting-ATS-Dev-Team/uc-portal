// Guided product tours -- a dimmed-overlay, spotlight-and-tooltip walkthrough
// of the app's core screens, scoped per real account type (current member,
// alumni, intern, admin) since each sees a genuinely different nav rail and
// has a different primary job here. See components/tour/TourContext.jsx for
// the engine (auto-start-once + manual replay) and
// components/tour/TourOverlay.jsx for the rendering.
//
// Each step's `target` is a CSS selector for the element to spotlight (or
// `null` for a centered, un-highlighted intro/outro card). Wherever an
// existing stable className already identifies the right element (e.g.
// ".filters", ".job-card__match"), this reuses it rather than adding a new
// data-tour attribute -- attributes were only added where nothing stable
// already existed to select on (nav rail items, by route; two visually
// identical AdminDashboard ".detail-section" blocks).
//
// `route`, when present, is where the engine navigates before showing that
// step -- tours span multiple real pages, not just one screen.

export const TOURS = {
  memberWelcome: {
    id: "memberWelcome",
    label: "Member basics",
    steps: [
      {
        route: "/",
        target: null,
        title: "Welcome to UC Portal",
        body: "A quick tour of the essentials -- recruiting, networking, and prep, all in one place. Skip anytime, and replay this later from your avatar menu.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/jobs']",
        placement: "right",
        title: "Jobs",
        body: "Every posting here is real, sourced daily from company career sites -- not a generic aggregator feed.",
      },
      {
        route: "/jobs",
        target: ".filters",
        placement: "right",
        title: "Filter to what matters",
        body: "Narrow by industry, role, deadline, comp, and more. Your onboarding preferences already seed a starting point.",
      },
      {
        route: "/jobs",
        target: ".jobs-tabs",
        placement: "bottom",
        title: "Recommended for you",
        body: "This tab is personalized -- ranked by your real match score, not just posting date.",
      },
      {
        route: "/jobs",
        target: ".job-card__match",
        placement: "left",
        title: "Match score",
        body: "Every job shows a real match score computed from your industry, role, location, and comp preferences. Open a job to see the full odds model, with a \"biggest lever\" callout for what would move the number most.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/applications']",
        placement: "right",
        title: "Applications",
        body: "Track every application from interested through an outcome, and log prep time as you go.",
      },
      {
        route: "/applications",
        target: ".tracker-view-toggle",
        placement: "bottom",
        title: "Board, Table, or Timeline",
        body: "Switch views anytime. Drag a card between stages on Board, or use the \"Move to\" control on any card or row -- works on touch too.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/network']",
        placement: "right",
        title: "Network",
        body: "Find UC alumni and current members by company, industry, or location, and request a coffee chat.",
      },
      {
        route: "/network",
        target: ".network-filters",
        placement: "bottom",
        title: "Filter the directory",
        body: "Search by company or industry to find who to talk to before an interview -- or check a job's own page for members already there.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/resources']",
        placement: "right",
        title: "Career Resources",
        body: "Learning tracks, free certifications, and a prep library -- plus case-practice partner matching, opt-in only.",
      },
      {
        route: "/",
        target: null,
        title: "You're set",
        body: "Replay this tour anytime from your avatar menu, top right. Head to Feed to see what UC is posting, or jump straight into Jobs.",
      },
    ],
  },

  alumniWelcome: {
    id: "alumniWelcome",
    label: "Alumni basics",
    steps: [
      {
        route: "/feed",
        target: null,
        title: "Welcome back to UC Portal",
        body: "As an alum, your view is focused on staying connected -- Feed, Network, and Messages -- rather than active recruiting. Skip anytime, and replay this later from your avatar menu.",
      },
      {
        route: "/feed",
        target: ".composer",
        placement: "bottom",
        title: "Share something real",
        body: "Post an update, a question, or an opportunity you're hiring for. Real posts, visible to every current member and alum.",
      },
      {
        route: "/feed",
        target: ".feed-tabs",
        placement: "bottom",
        title: "Browse by type",
        body: "Filter the feed down to job posts, write-ups, or questions.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/network']",
        placement: "right",
        title: "Network",
        body: "Reconnect with other alumni and current members by company or industry, and offer or request a coffee chat.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/profile']",
        placement: "right",
        title: "Your profile",
        body: "Add your real work history under the Work History tab -- it's the single most useful thing an alum can leave behind for current members to see who's worked where.",
      },
      {
        route: "/feed",
        target: null,
        title: "You're set",
        body: "Replay this tour anytime from your avatar menu, top right.",
      },
    ],
  },

  internWelcome: {
    id: "internWelcome",
    label: "Accelerator basics",
    steps: [
      {
        route: "/accelerator",
        target: null,
        title: "Welcome to the Accelerator",
        body: "A weekly curriculum to get you up to speed on how UC operates and how real consulting/recruiting work. Skip anytime, and replay this later from your avatar menu.",
      },
      {
        route: "/accelerator",
        target: ".detail-header",
        placement: "bottom",
        title: "Your progress",
        body: "Tracks how many weeks you've submitted, out of the total curriculum.",
      },
      {
        route: "/accelerator",
        target: ".step-row",
        placement: "bottom",
        title: "Each week unlocks in order",
        body: "A real submission -- not a timer -- is what unlocks the next week. Review the prep material, then submit your response below it.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/profile']",
        placement: "right",
        title: "Your profile",
        body: "Upload your resume here -- it's scanned for a quick set of suggestions (quantified bullets, weak opening phrases, length) to help before you're recruiting for real.",
      },
      {
        route: "/accelerator",
        target: null,
        title: "You're set",
        body: "Replay this tour anytime from your avatar menu, top right.",
      },
    ],
  },

  adminTools: {
    id: "adminTools",
    label: "Admin tools",
    steps: [
      {
        route: "/admin",
        target: null,
        title: "Admin Dashboard",
        body: "Everything here is real, live data -- not illustrative mock figures (those are labeled with an amber \"Illustrative\" tag where they still appear). Skip anytime, and replay this later from your avatar menu.",
      },
      {
        route: "/admin",
        target: "[data-tour='admin-opportunity-queue']",
        placement: "bottom",
        title: "Opportunity queue",
        body: "Postings submitted by members or through Post an Opportunity land here for review before going live.",
      },
      {
        route: "/admin",
        target: "[data-tour='admin-company-tiers']",
        placement: "bottom",
        title: "Company tiers",
        body: "Controls how many active postings a company can show at once, so a handful of large employers can't crowd out everyone else. Reclassifying takes effect on that company's next scheduled fetch.",
      },
      {
        route: "/",
        target: "[data-tour-nav='/admin/members']",
        placement: "right",
        title: "Members",
        body: "Promote a member to admin, or graduate an intern to full current-member access, from here.",
      },
      {
        route: "/admin",
        target: null,
        title: "That's the admin toolset",
        body: "Replay this tour anytime from your avatar menu, top right.",
      },
    ],
  },
};

// The tour that auto-starts once, the first time this account reaches its
// own landing route -- one per real account type, never more than one
// auto-started per account (admins get memberWelcome auto-started, same as
// any other current member; adminTools is manual-replay-only, since it's
// additive, not a first-run essential).
export function defaultTourId({ isAlumni, isIntern }) {
  if (isIntern) return "internWelcome";
  if (isAlumni) return "alumniWelcome";
  return "memberWelcome";
}

// Where defaultTourId's tour auto-starts from -- the route this account
// actually lands on after sign-in (Home / Feed / Accelerator respectively).
export const LANDING_ROUTE = {
  memberWelcome: "/",
  alumniWelcome: "/feed",
  internWelcome: "/accelerator",
};

// Every tour this account can manually replay from the avatar menu, in
// display order. Interns and alumni only ever see their one tour (the rest
// of the app is route-guarded away from them anyway); admins additionally
// get adminTools alongside the regular member tour.
export function availableTours({ isAdmin, isAlumni, isIntern }) {
  if (isIntern) return [TOURS.internWelcome];
  if (isAlumni) return [TOURS.alumniWelcome];
  const list = [TOURS.memberWelcome];
  if (isAdmin) list.push(TOURS.adminTools);
  return list;
}
