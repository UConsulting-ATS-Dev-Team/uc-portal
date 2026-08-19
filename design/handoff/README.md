# Handoff: UC Career — UConsulting career & education platform (desktop)

## Overview

UC Career is a private, members-only career and professional-development hub for **UConsulting (UC)**, a university consulting club. It replaces the scattered mix of spreadsheets, group chats, Handshake, and Google Drive folders that members currently use, with one place that carries information no public job board has: which UC alumni work where, what UC applicants actually experienced in interviews, and how past UC members performed at each firm.

It serves two audiences:

- **Members** (current students, class years ~2026–2029) — discover opportunities, track applications, meet alumni, and work through structured learning tracks and certifications.
- **Leadership** (Exec + Careers Committee) — see aggregate member interest, approve posted opportunities, and manage content and access.

The product has three intertwined jobs: **recruiting** (jobs, tracker, deadlines), **networking** (alumni directory, coffee chats, messages), and **education** (learning tracks, free certifications, the resource library). Any implementation that treats it as only a job board will miss the point — the distinguishing feature is that every job, company, and resource is annotated with UC's own private data.

## About the design files

The file in this bundle — `UC Career Platform Wireframes.dc.html` — is a **design reference created in HTML**. It is a wireframe prototype showing intended structure, information hierarchy, and behavior. It is **not production code to copy**.

The task is to **recreate these designs in the target codebase's environment** (React, Next.js, Vue, Rails, etc.) using that codebase's established patterns, component library, and conventions. If no codebase exists yet, choose an appropriate stack and implement the designs there.

The HTML file is a single scrollable canvas containing all 24 screens, grouped into three sections ("turns") with visible id badges (`1a`, `2b`, `3c`…). Each screen is a `.wf` block at a fixed 1280px width. Those ids are the canonical names used throughout this document.

## Fidelity

**Low-fidelity → mid-fidelity wireframes.** Deliberately grayscale with one steel-blue accent. Layout, hierarchy, component placement, and copy are all intentional and should be followed closely. **Visual styling should come from the target codebase's design system, not from these files' hex values.**

What to take literally:
- Screen inventory, navigation structure, and page composition
- Layout: column counts, sidebar widths, what sits in the main column vs. the right rail
- Every string of copy (labels, empty-state text, microcopy, button labels) — it was written deliberately
- Data shown per card/row and its ordering
- Which affordances exist on which screen

What to reinterpret in the target system:
- Exact colors, fonts, border widths, spacing values
- Component chrome (buttons, chips, inputs, avatars, tables)
- Icons (wireframes use text labels and plain squares; substitute real icons)

One caveat: the wireframes are styled on the **Industry** design system (steel-blue on light gray, Barlow Condensed headings over Barlow, square corners, hairline borders, no rounded cards). If UC does not yet have brand colors — the user has stated logos and colors are still to be decided — treat the accent color as a single themeable token rather than a commitment to steel blue.

---

## Navigation shell

Every authenticated screen shares one shell. Build this once.

**Top bar** (~52px tall, full width, bottom hairline border, surface background):
- Left: UC Career brandmark (square mark + wordmark)
- Left-of-center: global search input, ~300px wide, placeholder "Search jobs, people, companies…" — submits to the global search results page (`3b`)
- Right: notifications entry with unread count, then the current user's avatar (menu: profile, settings, sign out)

**Left navigation rail** (~206px wide, full height, right hairline border, surface background). Items in order:

1. Home
2. Jobs
3. Applications (with a count badge, right-aligned)
4. Network
5. Feed
6. Companies
7. Career Resources
8. My Profile

Active item: tinted background, 2px accent left border, heavier text weight. Inactive: muted text, transparent left border. Hover and focus states from the design system.

Below the main items, separated by a hairline rule with a small uppercase "LEADERSHIP" label, an admin group visible **only to Exec and Careers Committee roles**: Admin Dashboard, Opportunities, Members, Content.

At the bottom of the rail, a small framed block: club stats — "142 members · 380 alumni · invite only".

**Two rejected alternatives** are documented in the design history but were explicitly declined by the stakeholder: a top-bar-only nav and an icon rail with a contextual second column. Do not implement those. The left rail is the decision.

**Content area**: fills remaining space, ~20–24px padding. Most screens use a main column plus a fixed-width right rail (250–300px). Filter-heavy screens (Jobs, Companies) insert a second fixed left column (230–248px) between the nav rail and the main content.

**Responsive**: designed for laptop/desktop at 1280px and up. Below ~1100px, collapse the left nav rail to icons; below ~900px, this design does not define behavior — either scope the product to desktop or commission a mobile pass.

---

## Screens

### 1a — Home / Career Dashboard

**Purpose**: orient the member in five seconds — what needs attention today, what's newly relevant, and how their recruiting is going.

Main column, stacked:

1. **Welcome card** — avatar, "Welcome back, {firstName}", subtitle line ("Class of 2027 · Finance & Data Science · Recruiting focus: Summer 2027 internships"), a row of the member's preference chips (target industries, locations, type) with an "Edit preferences" chip that links to `2g`. Right side: profile-strength percentage with a progress bar.
2. **Recommended for you** — section label, "Based on your interests · View all 46" on the right. Two job cards side by side, each with company logo, role title, match-score badge, company/location/comp line, attribute chips (type, work mode, deadline), then a footer row with overlapping avatars of UC connections, the connection count, and a Save button.
3. **Recruiting progress** — a 4-cell stat strip (applications in progress, upcoming interviews, need action this week, saved jobs) over a list of 3 attention-needing applications. Each row: status dot, company + role, stage chip, timing text, and a contextual action button (Prep / Follow up / Apply).
4. **From the UC feed** — two recent feed posts as cards, each with author avatar, name + class year, role/affiliation, timestamp, post body, and a reaction/comment count line.

Right rail:
- **Recommended actions** — 4 rows, each a title plus a supporting detail line. These are computed nudges, not static links (e.g. "Prep for your Bain first round — 3 UC case guides · 2 past interviews").
- **UC people you should meet** — 3 suggested people with avatar, name, role, and a Chat button.
- **Deadlines this week** — date + role rows.

### 1d — Jobs (job board) — *the highest-priority screen*

**Purpose**: find opportunities, with UC's private advantages surfaced as first-class filters and annotations.

**Filter column** (248px, left of main content, own scroll):
- "Filters" header with "Clear all"
- Keyword input
- **UC advantage** (checkboxes): Recommended for me ✓, Has UC connections ✓, UC-posted only, Alumni referral available
- **Opportunity type** (checkboxes with counts): Internship (218), Full-time (96), Externship / spring week (14)
- **Graduation year** (chips): 2026, 2027 ✓, 2028, 2029
- **Industry** (checkboxes): Management consulting ✓, Investment banking, Tech / product strategy, Private equity, + "Show 8 more"
- **Location & work mode**: city input, then chips — Chicago ✓, New York ✓, Remote, Hybrid, In-person
- **Compensation**: dual-handle range slider, $25/hr–$60/hr+
- **Deadline** (chips): This week, This month ✓, Rolling
- **Company size** (chips): 1–50, 51–500, 501–5k, 5k+

**Main column**:
- Header: "Jobs" + "328 opportunities · 46 matched to your profile". Right side: sort dropdown (Best match), "Save this search", "Post a job" (primary → modal in `3c`).
- Tab row: Recommended for you (46) · UC-posted (23) · All jobs (328) · Saved (19). Right-aligned: active filter chips with ✕ removers.
- An explainer banner (accent-tinted, framed): "UC-POSTED OPPORTUNITY — Alumni-referred roles are posted by UC members and never appear on Handshake." with a "Learn more" link.
- **Job cards**, vertically stacked with gap. Each card: 46px company logo; title row with role name, match-score badge, and optional "UC-posted" chip; a company · location · work mode · compensation line; a chip row (type, class year, industry, deadline — deadline chip switches to accent styling when closing within 7 days); a UC-intelligence footer row with overlapping connection avatars, "6 UC connections" in accent, and past-cycle context ("4 UC members applied last cycle · 2 received offers"). Right edge, vertically centered: primary "View & apply", secondary Save/Saved, and a "Posted Nd ago" line.
- Cards for UC-posted roles carry a 3px accent left border.
- Pagination chips at the bottom.

Five example cards are in the file (Bain 94%, McKinsey 91%, Deloitte 88%, Stripe 84%, Goldman 79%) — note that lower-scoring cards explain *why* in the footer ("Outside your target locations").

### 1e — Job / opportunity detail

Breadcrumb, then main column:

1. **Header card** (accent left border) — logo, role title, match badge, full detail line, then an action row: "Apply on {company} site" (primary, external), "Add to my tracker", "Save ★", "Mark interested", and right-aligned deadline countdown ("Applications close Sep 12 · 11 days left").
2. **Why this is a 94% match for you** — two-column checklist. Checked items are matches ("Target industry: management consulting", "6 UC connections at this office"); unchecked muted items are mismatches ("Compensation below your $22k target"). This must be generated from the member's stored preferences, not authored per job.
3. **Your realistic odds** — see the dedicated section below. This is the product's signature feature.
4. **Role description** — prose plus a qualifications bullet list.
5. **UC recruiting intelligence** — 4-cell stat strip (UC applicants over 3 yrs, reached final round, received offers, median time to decision); a 5-stage horizontal recruiting timeline where completed stages have accent connector bars and future stages neutral; then **interview experiences from UC members** — cards with author avatar, name, outcome chip, cycle, and their write-up, plus "Add your experience" and "3 more write-ups".

Right rail:
- **UC members at {company}** (accent-tinted card) — 3 people with role/office lines and Coffee chat / Message buttons, then "See all 12 UC members".
- **Prep resources** — 3 titles with detail lines, linked to the library.
- **Similar UC-relevant roles** — 2 compact rows with logos and match scores.

### 1f / 1g / 1j — Applications tracker (three views, one page)

A segmented control in the header switches **Board / Table / Timeline**. All three read the same records; the stage taxonomy is shared:

`Interested → Preparing → Applied → Assessment → First round → Final round → Closed`

("Closed" covers rejected, withdrawn, and declined; closed cards render at reduced opacity.)

**1f — Board**: seven columns, one per stage, each with an uppercase stage label, a count, and a 2px rule beneath (accent for interview stages, neutral otherwise). Cards are compact: logo + company name, role, then one or two contextual detail lines (deadline urgency in accent, "Applied Aug 22 · 9 days ago", "Prep w/ Andre R. ’21 booked"). Some cards carry an inline action ("Follow up"). Cards drag between columns. The card whose interview is imminent carries an accent left border.

Header controls: view toggle, search, Filter dropdown, "+ Add application" (primary → modal in `3c`).

**1g — Table**: columns are Company (logo + name), Role, Stage (chip), Applied, Deadline, Next action, UC connections. Sort defaults to "Next action". Footer: "Showing 6 of 28", "Export CSV", "Sync deadlines to calendar".

**1j — Timeline**: a Gantt-style view over the recruiting cycle. Left column (212px) lists each opportunity (logo, company, role). Right side spans four month columns (Aug–Nov) with vertical month gridlines and a vertical "today" marker in accent. Rows are **grouped by current stage** with tinted group headers ("Interview rounds — 3", "Applied & assessment — 8", "Not yet applied — 8 · 2 deadlines this week"). Within a row, each stage the application has passed through renders as a horizontal bar positioned by date, shaded progressively darker by stage (Interested lightest → Interview rounds accent); **projected** future stages render as dashed outlines; **scheduled events** render as small rotated squares (diamonds) with adjacent labels ("final round · Sep 15, Chicago", "Solve game due Sep 6"). A legend above the grid maps every shade and mark. Bars are draggable to change dates.

The timeline is the view where the odds and prep story becomes visible over time — it is worth implementing properly rather than substituting a generic calendar.

### 1h — Network

Main column: header ("380 alumni · 142 current members · 41 open to coffee chats this month") with "My connections (18)" and "Chat requests (2)". A search input plus four filter dropdowns (Industry, Company, Location, Grad year), then active filter chips including audience toggles (Alumni / Current members) and a result count.

A 3-column grid of person cards: 44px avatar, name, "Alumnus · Class of 2021", current role and company, location · industry line, capability chips ("Ex-VP Careers", "Case coach", "Offers referrals", "2 mutual", "Same target industry"), then "Request coffee chat" (primary) + "Profile". For current members the primary becomes "Message".

Right rail: **Suggested for you** (accent card, three reasons — alumni at companies you track, in your target industry, similar career interests — each with one person and a + button); **Your coffee chats** (status per person: Confirmed with time, Request sent, Follow-up due); **Where UC alumni work** (company + count list).

### 1i — Member / alumni profile

Header card: 76px avatar; name, "Alumnus ’21" chip, "Open to coffee chats" chip; current role and location; a metadata line (industry, years of experience, UC tenure); action row — Request coffee chat (primary), Ask for advice, Message, Save to my network. A bordered right section, **"Your shared UC context"**, lists computed commonalities as bulleted lines (both on Careers Committee, 3 mutual UC connections, same target industry, works at a company you track).

Main column: **Experience** (logo + title/company, dates/location, optional description); **UC experience** (role, years, one-line contribution); **Contributions to UC** (2×2 grid — resources authored, interview write-ups, job postings, coffee chats held).

Right rail: Education; Skills & focus chips; **Happy to help with** (checklist — case practice ✓, resume review ✓, referrals ✓, full-time recruiting unchecked); Mutual UC connections.

### 2a — Feed

Main column is fixed at 660px (readability), right rail flexes.

Composer card: avatar + prompt input, then type buttons — Post a job, Interview write-up, Ask the network, Event — and a Post button.

Tab row: All · Alumni · Opportunities · Advice · Events · Saved.

Post cards. Each: author avatar; name; role chip (Alumna / Member / Announcement); post-type chip (Advice / UC-posted job / Interview write-up / Event); role + timestamp line; body copy; an optional **embedded object** (a linked resource card, or a full job card with match score and View button); then an engagement row — "↑ 18 helpful", comment count, Save, Share, and sometimes social proof ("3 members you know reacted"). Event posts replace the engagement row with RSVP + Add to calendar and an attendance line.

Note the reaction verb is **"helpful"**, not "like" — deliberate for a career context.

Right rail: an explainer card ("Why this feed is different — every post here comes from a UC member or alumnus…"); Trending in UC (topic + post count); Alumni active this week (with Follow buttons); Upcoming (date + event).

### 2b — Companies directory

Filter column (230px): company-name input; Industry checkboxes; **Recruiting status** (Currently hiring ✓, Opens soon, Closed for cycle); **UC connections** chips (Any, 5+ ✓, 10+, 20+); Company size chips; Location chips.

Main: header with counts ("184 companies · 61 with UC alumni · 38 hiring right now"), sort ("Most UC alumni"), "My watchlist (3)". Then a 2-column card grid. Each card: 44px logo, company name, optional "Watching" chip, industry · size · offices line, a one-sentence UC-specific characterization ("Broadest UC alumni presence of any firm…", "Thin UC presence but the strategy & ops track hires from consulting-style backgrounds"), a 3-cell stat strip (UC alumni / open roles / UC applicants), and role/deadline chips. Watched companies carry an accent left border.

### 2c — Company page

Header card: 64px logo; name; "Hiring now" and "N UC alumni" chips; industry · size · offices line; a descriptive paragraph noting how UC members typically enter; actions — Add to watchlist (primary), See N open roles, Request an intro.

Tab row: Overview · Opportunities · UC connections · Recruiting intelligence · Activity.

Main column: **Open opportunities** (rows with title, detail line, match badge or "Not your year", View); **Recruiting intelligence** (4-cell strip — UC applicants, final rounds, UC offer rate, median prep hours of offer-holders — plus the 5-stage timeline and "What UC members say" quote cards); **Community activity** (alumni posting referrals, promotions, scheduled coffee-chat blocks).

Right rail: UC members here (accent card, 3 shown + "See all 12"); Offices UC members work in (with counts); Prep resources for this company; Similar companies.

### 2d — Career Resources library — *the education hub*

**Purpose**: this is not only interview prep. It is UC's general education and professional-development hub, and the design gives skills and certifications equal billing with recruiting material.

Left column (190px), two grouped nav lists:

*Categories*: All resources (128) · Resume (14) · Cover letter (6) · Consulting cases (31) · Behavioral (18) · Networking (12) · Recruiting timelines (9) · Industry guides (15) · Company guides (23)

*Skills & certifications*: Free certifications (36) · Excel & modeling (11) · SQL & data (14) · AI & automation (9) · Slide & comms craft (8) · Accounting & finance (10)

Below: **Your progress** card — completed count over total, a progress bar, and current track status.

Main column, in order:

1. **Recommended** (accent card) — "Recommended for your Bain first round", "Based on your tracker", with three resource tiles. Recommendations are driven by the member's tracker stages and stated needs.
2. **Learning tracks — structured, start to finish** — three track cards (Case Interview Track, 12 steps; Behavioral & Fit Track, 8 steps; Excel, SQL & AI Tools, 10 steps), each with a category chip, step count, a one-line curriculum summary ("Frameworks → math → live cases"), a progress bar, and a status line ("3 of 12 · continue" / "Not started"). Tracks link to `3d`.
3. **Free certifications — vetted by the Careers Committee** — a table with columns Certification, Provider, Cost (chip: "Free" / "Free via UC"), Time (hours), Counts for (which career tracks), and a Start button. Header notes "36 free · 8 discounted for UC · browse all". Example rows span Coursera audits, Google certificates, CFI free tier, Mode Analytics, and a UC-internal AI course — deliberately mixing external free offerings with UC-authored material.
4. **Most used in UC** — 2-column resource cards with category chip, saved indicator, title, format/length/updated line, description, and an author + view/completion count line.
5. **Recently added** — compact rows: category chip, title, author + age.

Header controls: search resources, "My saved (7)", "+ Contribute" (primary → modal in `3c`).

### 2e — Resource detail

Main column: a header card with chips (category, Internal, page count, updated date), title, description, a maintainer row (avatar, name, "Maintained by … and 4 contributors", view/completion counts), and actions — Open guide (primary), Download PDF, Saved ★, Mark as completed.

**Contents** card — a checklist of sections with per-section page counts; completed sections checked.

**UC-specific notes** card (accent left border) — bulleted claims that justify the resource's existence, including outcome data ("Members who completed sections 1–3 before round 1 had a 2.4× higher advance rate").

Right rail: **Your progress** (sections completed, percentage, bar, last-opened, hours logged, "Log prep time" button → modal in `3c`); **Used for** (which of the member's tracked applications this resource supports); Related resources; **Members who completed this** (avatar cluster + count).

### 2f — Notifications

Tab row: Needs action (4) · Deadlines · Network · Jobs · UC announcements · All.

**Needs action** section — rows with an accent left border. Each: icon/logo, a headline that states the consequence ("Goldman Sachs — IBD Summer Analyst closes in 3 days", "Bain first round is in 3 days — you're at 11 of 26 median prep hours"), a supporting line, and one or two inline actions (Apply / Snooze, Start / Read guide, Confirm / Reschedule, Prep now).

**Earlier this week** — a lower-density list: avatar/logo, one-line description, and a source + age line ("Feed · 2d", "Job alert · 3d", "UC announcement · 3d", "Alumni update · 1w").

Right rail: **This week at a glance** (date + item); **Notification settings** (checkboxes: deadline reminders 3 days out ✓, new matched jobs ✓, alumni replies ✓, all feed activity ✗, weekly digest ✓).

### 2g — My Profile / preferences

Header: title, "Last updated Aug 2 · UC asks you to refresh this each quarter at GM", plus "View as others see it" and "Save changes".

A **quarterly check-in banner** (accent card): "Your interests were last confirmed in spring. Takes 90 seconds and improves every recommendation you see." + "Update interests". This reflects a real club process — interests are re-collected each quarter at the general meeting — and should be a recurring prompt, not a one-time nag.

Tab row: Personal · Career preferences · Recruiting settings · Privacy.

Main column:
- **Personal information** — 2-column fields: full name, graduation year, major, UC role, LinkedIn, resume (filename + Replace).
- **Career preferences — these drive your recommendations**: target industries as **ranked, draggable** chips; target roles; target locations plus an "Open to relocating" checkbox; opportunity type as a segmented control (Internship / Full-time / Both); compensation expectation as a slider; companies of interest; recruiting timeline chips.
- **Recruiting settings** — a 2-column checkbox grid: show jobs outside target locations ✓, let alumni see I'm recruiting ✓, prioritize roles with UC connections ✓, open to coffee chat requests from members ✗, share application outcomes with UC anonymized ✓, include me in Exec's interest reporting ✓.

Right rail: avatar card with Change photo; **Profile strength** (percentage, bar, and a checklist of what's missing); **What this changes** — an explainer that preferences drive recommended jobs, match scores, suggested alumni, and the odds estimate, plus the privacy assurance "Exec sees aggregate interest only — never your applications."

### 2h — Admin dashboard (Exec / Careers Committee only)

Top bar gains an "Admin mode" chip. Header: cycle selector, Export report, "+ Post opportunity".

A 5-cell KPI strip: active members (142, +16 vs last quarter), profiles up to date (88%, 17 stale), applications tracked (614, 4.3 per member), coffee chats booked (73, +31 vs last cycle), offers reported (29 — 21 internships, 8 FT).

Main column:
- **Where members want to work** — horizontal bars per industry with member counts, sourced from the quarterly interest check-ins. Below the chart, a computed insight line: "Gap: 48 members target tech strategy but UC has only 6 alumni there — a recruiting-outreach target for this cycle." This gap analysis is the dashboard's real purpose; it tells Exec where to recruit alumni speakers.
- **Class-year breakdown** — 4 cells, one per class year, each with member count, a contextual label ("onboarding", "peak recruiting", "full-time"), and a profile-completeness bar.
- **Opportunity queue** — a table (Company, Role, Source, Status, Action) where member- and alumni-submitted postings await review. Sources: Alumni post, Member submitted, Feed import, Admin. Statuses: Needs review, Expired, Live with applicant count. Actions: Approve / Edit / Remove.

Right rail: Most targeted companies (with member counts); **Member engagement** (logged in this week, tracking ≥1 application, booked a coffee chat, contributed a resource, and — in accent — never opened the platform, with a "Nudge inactive members" button); Content management links (add resource, manage company pages, moderate feed — with a flagged count, post announcement, manage member access); **Access control** note (roster-provisioned, auto-conversion to alumni at commencement, pending removals).

Privacy boundary, important: admins see **aggregate interest and engagement**, never an individual's application list. The member-facing copy in `2g` promises this.

### 2i / 2j — Onboarding (5 steps + completion)

`2i` shows step 3 at full size; `2j` stacks steps 1, 2, 4, 5 and the completion screen in one frame for review. Implement as a 5-step flow with a persistent 5-segment progress indicator (completed segments accent, current segment accent with emphasized label, future neutral), "Save & finish later" in the header, Back/Continue footer with a step counter, and content capped at 720px centered on the page background.

- **Step 1 — You**: confirm roster-provided details (name, graduation year, majors, UC committee), then an optional resume drop zone whose copy states it pre-fills later steps.
- **Step 2 — Industries**: pick up to three, **ranked**. The ranking list shows selected industries in order with drag handles and, per industry, UC-specific context ("101 members · 61 alumni") — so the member sees where the club's network actually is. An empty third slot invites but doesn't require a third pick. Below, the full industry chip set, including "Still figuring it out".
- **Step 3 — Roles & locations**: role chips (max 5) with a line explaining which were suggested from their major and industry picks; location chips plus "Open to relocating" and "Only show me hybrid or remote"; then a running-total accent card: "Your answers already match **46 open roles** and **23 UC alumni** — including 12 at Bain and Deloitte in Chicago." That live payoff should update as answers change; it is what makes finishing the flow feel worthwhile.
- **Step 4 — Companies**: suggested companies ranked by UC alumni presence, each with alumni and open-role counts and a Follow toggle; plus a search-to-follow input.
- **Step 5 — Timeline**: recruiting cycle chips; a "What would help most right now?" checkbox set (case practice, resume review, behavioral prep, technical skills & certifications, alumni intros, deciding between industries) that seeds their learning tracks; and reminder preferences.
- **Completion**: "You're set up, {firstName}" over a 4-cell payoff strip (46 matched roles, 23 alumni to meet, 3 learning tracks queued, 5 deadlines this month), then **three concrete first actions** drawn from their answers (earliest matched deadline, a specific alum open to chats, the learning track matching their stated need), a "keep it current" note about the quarterly check-in, and "Go to my dashboard".

### 3a — Sign in & access states

Four states, all centered at 440px on the page background:

1. **Sign in** — brandmark, "UC Career is private to UConsulting members and alumni.", primary "Continue with your university Google account", an "or" divider, email + password fields, a secondary Sign in, then "Forgot password" and "Alumni — request access". A footer note explains roster provisioning and automatic alumni conversion at commencement.
2. **Not on the roster** — states the specific address that failed, explains why, offers "Request access" and "Try another account", and sets an expectation ("Requests are reviewed at the weekly Exec meeting · typically 2–3 days").
3. **Access pending** — submission date, who reviews it, a Pending chip, and Resend.
4. **Loading skeleton** — the app-wide pattern: neutral skeleton bars inside the same hairline card frame as the loaded content, no spinners.

### 3b — Global search results

Query echoed in the header input and in the page title ("Results for “bain”"), with a total count. Tab row scoped by type with counts: All (38) · Jobs (2) · People (12) · Companies (1) · Resources (9) · Feed posts (14).

The **All** tab groups results by type in a fixed priority order — Company, Jobs, People, Resources, Feed posts — each group with a label, a "See all N" link, and 1–3 results. Group rows reuse the compact list-row pattern from elsewhere, each with the type-appropriate primary action (View company / View / Coffee chat / Message).

Right rail: **Refine** checkboxes (only things I can act on, my saved items, added in last 30 days); Recent searches; and a note documenting the **no-results** behavior — show the closest company match, the nearest resource category, and an "ask the network" prompt that opens a feed composer prefilled with the query.

### 3c — Action modals

Five modals, each ~600px wide, each with a title row and ✕, and each ending in a footer action row. These are the destinations for primary CTAs that appear across the app.

1. **Request a coffee chat** — a context card for the recipient (avatar, role, "typically replies in 2 days", Open to chats chip); topic chips ("helps him prepare"); a time-slot grid drawn from the recipient's stated availability, multi-select; a format segmented control (Video 30 min / Phone 20 min / In person); an optional note with a character limit; footer note "He'll see your profile and target industries" + Cancel / Send request.
2. **Add an application** — three entry tabs (From a UC posting / Paste a link / Enter manually). The default tab searches UC postings and shows a result list. Then fields: Stage, Deadline, Date applied, Next action, Notes; two checkboxes — "Remind me 3 days before the deadline" ✓ and "Share the outcome with UC anonymously when it closes" ✓ (this second one is how the recruiting-intelligence dataset gets fed).
3. **Post an opportunity** — company, role title, type, class year(s), location, work mode, compensation, deadline, application link, description, industry tags. Then an accent-framed **referral block**: "I can refer UC applicants for this role" ✓ with a count field, and a note that members will see "referral available" on the listing. Footer states the review requirement: "Goes to the Careers Committee for review before it's live" + Submit for review.
4. **Contribute to the library** — a type selector (Interview write-up ✓ / Guide or doc / Case / Certification / Template / External link) that changes the subsequent fields. For a write-up: company, round, cycle, outcome, title, "What happened" long text, file drop zone, categories, and an "Post anonymously — your name is hidden, class year still shows" checkbox. Footer: Save draft / Publish.
5. **Log prep time** — which application, activity type, time, optional "with whom", optional resource used, then an accent **effect card**: "Brings you to 12.5 of the 26 median hours for offer-holders — your Bain odds estimate moves 24% → 27%." Showing the consequence is what makes members log time at all.

### 3d — Learning track detail

Header card (accent left border): chips (category, step count, total hours, Self-paced), track title, a description explaining what the track is built from, then a progress block ("3 / 12" plus a bar) with "Continue — step 4" (primary) and "Log prep time".

Main column: the **12 steps** as a checklist. Each row: completion checkbox, step number, title, a format/length line ("Reading · 20 min · UC Case Guide §1", "Interactive · 10 drills · 1 hr", "Peer session · 1 hr · book from Network", "Live event · Sep 16, 7:30pm · RSVP"), and a right-side state — completion date, a Start button on the current step, "Locked until 4", or an RSVP button. The current step's row is tinted full-bleed. Note the step types deliberately mix self-serve content, peer sessions, alumni-coached mocks, and live club events — the track spans the whole club, not just documents.

Right rail: **Why finish this** (accent card, with the outcome statistic and its sample size); **Tied to your applications** (which tracked applications this track serves, plus "Time logged here counts toward the prep factor in your odds estimate"); **Members on this track** (avatar cluster, active/finished counts, "Find a case partner"); Other tracks.

### 3e — Empty & first-run states

Five states, presented as a stack for review but belonging on their respective screens. The persona is Nina B., class of 2029, first login.

1. **Home, first login** — "Welcome to UC Career, Nina", class + "new member · nothing tracked yet", a paragraph that lowers the barrier ("You don't need to be recruiting to use this"), 15% profile strength, and three next-step tiles: complete the interest flow (primary), browse where UC alumni work, start the Networking track.
2. **Applications, empty** — the real page header and view toggle remain (so the member learns the UI), with dashed column placeholders, "Nothing tracked yet", copy explaining why to add a role you haven't applied to, and two actions: "+ Add your first application", "Browse 46 matched roles".
3. **Jobs, no results** — active filter chips stay visible with "0 results", and the empty state is **diagnostic**: "Dropping **Remote** would show 6 roles. Dropping **$50/hr+** would show 14." Actions: Drop "Remote" (primary), Clear all filters, Save as an alert — with a note that they'll be emailed when a matching role is posted.
4. **Network, no connections** — dashed avatar placeholders, "You haven't met anyone here yet", copy that surfaces supply ("41 alumni are open to coffee chats this month") and reduces intimidation (the Networking track walks you through the first message), plus two actions.
5. **Error** — "We couldn't load your jobs", a reassurance that tracked data is safe, then Try again + Report to Careers Committee.

Pattern to follow for all empty states: name the situation, explain why the feature matters in UC terms, quantify what's available, and offer one primary and one secondary action. Never a bare "No data".

### 3f — Messages

Two-pane layout inside the shell.

**Conversation list** (280px): header with "Messages" and a New button, a search input, then tabs — All (6) · Requests (2) · Unread (1). Rows: avatar, name, timestamp, and a preview line. The preview carries state where relevant ("Coffee chat request · pending", "You: Thanks again for the referral…"). Active conversation: tinted with a 2px accent left border.

**Thread pane**: header with the correspondent's avatar, name, a context line that includes any scheduled chat ("Consultant, Bain — Chicago · coffee chat Wed 4:00pm"), and "View profile" / "Add to tracker" actions. The message area sits on the page background: a centered system line marking the origin of the thread ("Coffee chat request accepted · Aug 30"), incoming bubbles left-aligned on surface with a hairline border, outgoing bubbles right-aligned with accent tint and border, each with an author + age line. **Shared resources render as an inline card** with logo, title, attribution, and an Open button. Composer: a multi-line input plus Attach / Share a resource / Propose a time and Send.

---

## The odds model (`1e`) — specification

This is the feature most likely to be implemented wrong, so it is specified rather than described.

The card shows an estimated probability that this member receives an offer from this specific opportunity. Layout: a 190px left panel with the headline percentage, a baseline comparison block, and then a right-hand factor table.

**Left panel**:
- Headline estimate, large, in accent (design shows 24%)
- Three comparison rows: Open-market baseline (3.5%), Past UC applicants (29%), Your percentile in UC (62nd)

The baseline comparison is essential — a bare "24%" reads as discouraging until it sits next to a 3.5% open-market rate.

**Factor table** — columns: Factor, Where you stand, Weight, Contribution (a horizontal bar).

| Factor | Weight | Signal shown | Bar |
|---|---|---|---|
| UC track record here | 30% | "4 offers / 14 applicants" | 82% (accent) |
| Preparation logged | 25% | "11 hrs · offer median 26 hrs" | 31% (neutral) |
| Networking depth | 20% | "2 of 6 UC connections chatted" | 44% (neutral) |
| Profile & resume fit | 15% | "94% match to posting" | 94% (accent) |
| Timing of application | 10% | "11 days before deadline" | 70% (accent) |

Bars render in accent when the factor is a strength and neutral when it's a weakness, so the member can scan for what to fix.

**Biggest lever** — an accent-framed callout beneath the table naming the highest-marginal-value action and quantifying it: "Two more prep sessions and one coffee chat with Sana Liu ’19 would move you to an estimated 38%." plus a "Log prep" button.

**Implementation notes and open decisions the design does not settle:**

- Each factor should produce a normalized 0–1 sub-score; the estimate is the weighted sum scaled against the UC base rate for that company (or the industry base rate when company data is thin). The exact functional form is a product/data decision — the design only fixes the factors, the weights, and the presentation.
- **Sparse data is the main risk.** With 1–2 past UC applicants at a company, the "UC track record" factor is noise. Decide on a minimum sample (suggest ≥5 applications) below which that factor is either suppressed, shown with an explicit low-confidence label, or shrunk toward the industry mean. Do not show a confident percentage built on n=1.
- Prep hours come from logged prep time (`3c` modal, `3d` track steps, `2e` resource sessions). If logging is sparse the factor under-reports; consider crediting completed track steps automatically.
- Networking depth counts coffee chats completed with UC connections at that company, over the total available.
- Timing is measured as days between submission and deadline (earlier is better), so it can only be estimated before applying.
- The "biggest lever" is a marginal-value calculation across factors, not a static string — recompute it whenever inputs change.
- Show the model's inputs honestly. The card's credibility depends on every number being traceable to something the member can see elsewhere in the app.

---

## Data model sketch

Entities the screens imply, with the non-obvious fields:

- **User** — role (member / alumnus / exec / careers-committee), classYear, majors, ucCommittee, ucRoleHistory, resume, profileStrength, openToChats, helpTopics[], availability slots, privacy flags (visibleAsRecruiting, shareOutcomesAnonymized, includeInInterestReporting)
- **CareerPreferences** — rankedIndustries[], targetRoles[], targetLocations[], openToRelocating, workModes[], opportunityType, compensationTarget, watchedCompanies[], recruitingCycle, helpNeeded[], lastConfirmedAt (drives the quarterly check-in prompt)
- **Company** — industry, size, offices[], ucAlumniCount, openRoleCount, ucApplicantCount, ucOfferRate, medianPrepHours, recruitingTimeline[], ucCharacterization (the editorial one-liner)
- **Opportunity** — company, title, type, classYears[], location, workMode, compensation, deadline, applicationUrl, description, qualifications[], industryTags[], source (admin / alumni / member / import), status (needs-review / live / expired), postedBy, referralAvailable + referralSlots, matchScore (computed per user)
- **Application** (a user's tracked record) — opportunity or manual entry, stage, appliedAt, deadline, nextAction, notes, reminderEnabled, shareOutcomeAnonymized, stageHistory[] with dates (**required for the timeline view `1j`**), projectedStages[]
- **Person connection / CoffeeChat** — requester, recipient, topics[], proposedSlots[], confirmedSlot, format, note, status (requested / accepted / confirmed / completed / declined), followUpDueAt
- **Message / Thread** — participants, messages (author, body, sentAt), attachments, sharedResources[], originatingCoffeeChat
- **Resource** — type (guide / case / write-up / template / certification / external link), categories[], author (nullable when anonymous), classYearOfAuthor, company + round + cycle + outcome for write-ups, sections[] with page counts, provider/cost/hours/countsFor for certifications, viewCount, completionCount
- **LearningTrack** — category, steps[] (each with type: reading / interactive / cases / peer-session / coached-session / live-event / assessment, title, duration, unlock rule, linked resource or event), outcomeStatistic
- **UserProgress** — per resource section and per track step: completedAt; plus PrepLog entries (application, activity, minutes, withWhom, resourceUsed, loggedAt) feeding the odds model
- **FeedPost** — author, type (advice / job / write-up / event / announcement), body, embeddedObject (opportunity | resource | event), reactions ("helpful"), comments, savedBy[]
- **Notification** — category (needs-action / deadline / network / job / announcement), headline, detail, actions[], sourceRef, readAt, snoozedUntil
- **InterestSnapshot** — the quarterly check-in record per user per term; `2h`'s aggregate charts read from these, not from live preferences, so Exec can see trends over time

Roles and permissions: members see their own data plus aggregate club data; alumni see member profiles and can post opportunities and resources (subject to review); exec/committee additionally see `2h`, the opportunity queue, flagged feed posts, and access requests — **but never individual members' application lists**.

## Interactions & behavior

- **Navigation**: rail items are page-level routes. Search submits to `3b`. Notification count in the top bar reflects the "Needs action" tab count in `2f`.
- **Tracker**: drag cards between board columns to change stage (optimistic update); the three views share state and scroll position where possible; timeline bars are draggable to edit dates; changing stage should prompt for the date that stage began (the timeline depends on `stageHistory`).
- **Filters** (`1d`, `2b`, `1h`): apply immediately, reflect in the URL, render as removable chips, and never silently return zero — when a filter set empties the results, show the diagnostic empty state from `3e` computed from which single filter is most costly.
- **Modals** (`3c`): focus-trapped, Escape closes with a confirm-on-dirty, footer actions right-aligned, primary last. The "Add application" and "Post opportunity" forms should support save-as-draft.
- **Onboarding**: every step is skippable except step 1; progress persists ("Save & finish later"); the running match count in step 3 recomputes live; completion routes to the dashboard.
- **Coffee chat lifecycle**: request → recipient accepts/declines → time confirmed → thread opens in `3f` → after the date, a follow-up prompt appears in `1h` and `2f`.
- **Prep logging**: available from a job page, a resource, and a track step; on save, recompute and animate the odds figure so the causal link is visible.
- **Opportunity review**: member/alumni submissions enter `2h`'s queue as "Needs review"; approval publishes them and notifies followers of that company.
- **Loading**: skeletons per the `3a` pattern, never full-page spinners.
- **Validation**: application/opportunity forms require company, title, and either a deadline or "rolling"; coffee chat requests require at least one topic and one time slot; resource contributions require a category.

## Design tokens

Take tokens from the target codebase. If none exist, the wireframes were built on the **Industry** design system and these are the values in the file:

- Ground `#f2f2f3`; surface `#ffffff`; text `#1d1f20`
- Accent `#5980a6`; accent deep (text on tint) `#41607f`; accent tint (fills) `#eaeff4`; accent tint border `#b7c7d6`
- Neutrals: `#d4d4d7` (borders), `#e7e7ea` (inner rules), `#b7b7ba` (placeholder outlines), `#98989b`, `#7a7a7d` (muted text), `#5d5d60` (secondary text), `#f5f5f8` (table headers, subtle fills)
- Type: Barlow Condensed 600 for headings and numerals; Barlow 400/500 for body. Body 13px, secondary 12px, meta 11px, section kickers 9.5px uppercase with 0.12em tracking, page titles 22–30px, display numerals 20–46px
- Square corners throughout (0 radius); 1px hairline borders; 2–3px accent left borders for emphasis; flat surfaces, no shadows in the wireframes
- Spacing rhythm: 6/7/9/11/14/16/20/24px

**Caveat**: UC's real brand (logo, colors) is still to be decided. Treat the accent as one themeable token so it can be swapped for the club's color without touching layout.

## Assets

None. The wireframes use no images: company logos are 4-letter text placeholders in bordered squares, avatars are initials in bordered circles, and icons are omitted in favor of text labels. Implementation will need real company logos (or a logo service), user avatar uploads, and an icon set — the design system specifies **Lucide at stroke-width 1.5**.

## Files

- `UC Career Platform Wireframes.dc.html` — all 24 screens on one canvas. Open in a browser and scroll; sections are ordered newest-first (turn 3, then turn 2, then turn 1), and every screen carries its id badge (`1a`, `2d`, `3c`…) in the label above it.
- `_ds/` — the Industry design system (stylesheet + bundle) the wireframes are styled with. Reference only; do not port it if the target codebase has its own system.
