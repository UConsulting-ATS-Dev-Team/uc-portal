// Maps a real `people` table row into the exact shape data/mockPeople.js's
// PEOPLE objects already have, so components/pages built against mock
// people (Network, Member profile, CompanyPage's UC-connections tab,
// JobDetail's "UC members at company" rail) work unchanged. Same pattern
// as data/realJobAdapter.js for jobs.
//
// status is "Current member" or "Alumni" (not mock's gendered "Alumnus"/
// "Alumna") -- there's no reliable, appropriate way to infer a real
// person's gender from a name, so real records use one neutral label.
// Every existing status check in Network.jsx/MemberProfile.jsx compares
// against "Current member" specifically or just checks "is it that",
// so this doesn't need any code changes there.
//
// openToCoffeeChats and mutualConnections have no real source data --
// defaulting both to false/0 (never true/nonzero) rather than fabricating
// a specific claim about a real, named person's consent or relationships.
// classYear is often approximate for alumni (derived from admit/graduating
// class text, not a verified fact) -- see the import script's own note;
// admitClass/graduatingClass are kept as the real raw text so a profile
// can show its actual source instead of just a possibly-off derived number.
export function realPersonToCardShape(row) {
  return {
    id: row.id,
    isReal: true,
    name: row.name,
    classYear: row.class_year,
    status: row.status,
    company: row.company,
    office: row.location,
    role: row.role,
    industry: row.industry,
    location: row.location,
    openToCoffeeChats: false,
    mutualConnections: 0,
    email: row.email,
    linkedin: row.linkedin,
    major: row.major,
    mentor: row.mentor,
    admitClass: row.admit_class,
    graduatingClass: row.graduating_class,
    // A real headshot sourced from the club's own public team page (see
    // CLAUDE.md's dated entry) -- Network.jsx/RealMemberProfile.jsx treat
    // this as a fallback, preferring a self-uploaded profiles.avatar_url
    // (via avatarsByEmail) when a member has since signed up and uploaded
    // their own photo.
    avatarUrl: row.avatar_url,
  };
}
