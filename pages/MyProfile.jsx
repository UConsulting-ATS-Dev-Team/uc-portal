import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { INDUSTRIES, ROLES, SKILLS, LOCATIONS, COMPANIES, RECRUITING_CYCLES } from "../data/careerOptions.js";
import { computeProfileStrength, displayName, initialsFromName } from "../data/profileUtils.js";
import "../styles/jobDetail.css";
import "../styles/onboarding.css";
import "../styles/tracker.css";
import "../styles/memberProfile.css";
import "../styles/auth.css";
import "../styles/myProfile.css";

const TABS = ["Personal", "Career preferences", "Recruiting settings", "Privacy"];

const RECRUITING_SETTINGS_COPY = [
  { key: "showOutsideTargetLocations", label: "Show jobs outside my target locations" },
  { key: "letAlumniSeeRecruiting", label: "Let alumni see I'm recruiting" },
  { key: "prioritizeUcConnections", label: "Prioritize roles with UC connections" },
  { key: "openToCoffeeChatRequests", label: "Open to coffee chat requests from members" },
  { key: "shareOutcomesAnonymized", label: "Share application outcomes with UC anonymized" },
  { key: "includeInExecReporting", label: "Include me in Exec's interest reporting" },
];

function move(list, index, direction) {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Accepts either a bare handle ("joshualowenberg") or a full/partial URL
// ("linkedin.com/in/joshualowenberg", "https://www.linkedin.com/in/joshualowenberg/")
// and normalizes to a canonical, clickable https://www.linkedin.com/in/<handle>/
// URL. Runs on blur, not on every keystroke -- reformatting while someone's
// still typing is exactly the class of bug the Full name field just had.
function normalizeLinkedInUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withoutAt = trimmed.replace(/^@/, "");
  const inMatch = withoutAt.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (inMatch) return `https://www.linkedin.com/in/${inMatch[1]}/`;
  if (/linkedin\.com/i.test(withoutAt)) {
    return /^https?:\/\//i.test(withoutAt) ? withoutAt : `https://${withoutAt}`;
  }
  const handle = withoutAt.replace(/^in\//i, "").replace(/^\/+|\/+$/g, "");
  return handle ? `https://www.linkedin.com/in/${handle}/` : "";
}

export default function MyProfile() {
  const {
    preferences,
    updatePreferences,
    updateRecruitingSetting,
    profileOverrides,
    updateProfileOverrides,
    profileLastUpdated,
    touchProfileUpdated,
  } = useAppState();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Personal");
  const [saved, setSaved] = useState(false);
  const [photoNote, setPhotoNote] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const fileInput = useRef(null);

  const [form, setForm] = useState({
    fullName: displayName(currentUser, profileOverrides),
    classYear: currentUser.classYear,
    majors: currentUser.majors,
    ucCommittee: currentUser.ucCommittee,
    linkedIn: profileOverrides.linkedIn,
    resumeFileName: profileOverrides.resumeFileName,
  });

  function handleSaveChanges() {
    const linkedIn = normalizeLinkedInUrl(form.linkedIn);
    setForm((f) => ({ ...f, linkedIn }));
    updateProfileOverrides({ fullName: form.fullName, linkedIn, resumeFileName: form.resumeFileName });
    touchProfileUpdated();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function toggleIndustry(name) {
    const already = preferences.industries.includes(name);
    if (already) updatePreferences({ industries: preferences.industries.filter((n) => n !== name) });
    else if (preferences.industries.length < 3) updatePreferences({ industries: [...preferences.industries, name] });
  }

  function toggleRole(role) {
    const already = preferences.roles.includes(role);
    if (already) updatePreferences({ roles: preferences.roles.filter((r) => r !== role) });
    else if (preferences.roles.length < 5) updatePreferences({ roles: [...preferences.roles, role] });
  }

  function toggleSkill(skill) {
    const already = preferences.skills.includes(skill);
    updatePreferences({ skills: already ? preferences.skills.filter((s) => s !== skill) : [...preferences.skills, skill] });
  }

  function toggleLocation(loc) {
    const already = preferences.locations.includes(loc);
    updatePreferences({ locations: already ? preferences.locations.filter((l) => l !== loc) : [...preferences.locations, loc] });
  }

  function toggleCompany(name) {
    const already = preferences.followedCompanies.includes(name);
    updatePreferences({
      followedCompanies: already
        ? preferences.followedCompanies.filter((c) => c !== name)
        : [...preferences.followedCompanies, name],
    });
  }

  const { checks: strengthChecks, pct: strengthPct } = computeProfileStrength(preferences, form.linkedIn);

  return (
    <div>
      <div className="profile-page-header">
        <div>
          <h1>My Profile</h1>
          <p className="profile-page-header__meta">
            Last updated {formatDate(profileLastUpdated)} · UC asks you to refresh this each quarter at GM
          </p>
        </div>
        <div className="profile-page-header__actions">
          <button className="btn btn-secondary">View as others see it</button>
          <button className="btn btn-primary" onClick={handleSaveChanges}>
            {saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="quarterly-banner">
        <span>Your interests were last confirmed in spring. Takes 90 seconds and improves every recommendation you see.</span>
        <button className="btn btn-primary" onClick={() => navigate("/onboarding")}>
          Update interests
        </button>
      </div>

      <div className="jobs-tabs" style={{ marginBottom: "var(--space-6)" }}>
        <div className="jobs-tabs__list">
          {TABS.map((t) => (
            <button key={t} className={`jobs-tabs__tab${tab === t ? " is-active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-layout">
        <div className="profile-main">
          {tab === "Personal" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Personal information</h2>
              <div className="profile-fields-grid">
                <div className="field">
                  <label>Full name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Graduation year</label>
                  <input
                    type="number"
                    value={form.classYear}
                    onChange={(e) => setForm((f) => ({ ...f, classYear: Number(e.target.value) }))}
                  />
                </div>
                <div className="field">
                  <label>Major</label>
                  <input type="text" value={form.majors} onChange={(e) => setForm((f) => ({ ...f, majors: e.target.value }))} />
                </div>
                <div className="field">
                  <label>UC Role(s)</label>
                  <input
                    type="text"
                    value={form.ucCommittee}
                    onChange={(e) => setForm((f) => ({ ...f, ucCommittee: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>LinkedIn</label>
                  <input
                    type="text"
                    placeholder="linkedin.com/in/… or just your handle"
                    value={form.linkedIn}
                    onChange={(e) => setForm((f) => ({ ...f, linkedIn: e.target.value }))}
                    onBlur={(e) => setForm((f) => ({ ...f, linkedIn: normalizeLinkedInUrl(e.target.value) }))}
                  />
                </div>
                <div className="field">
                  <label>Resume</label>
                  <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                    <span className="meta">{form.resumeFileName || "No resume uploaded"}</span>
                    <button className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
                      Replace
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      style={{ display: "none" }}
                      onChange={(e) => setForm((f) => ({ ...f, resumeFileName: e.target.files?.[0]?.name || f.resumeFileName }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "Career preferences" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Career preferences</h2>
              <p className="meta" style={{ marginTop: "calc(-1 * var(--space-4))" }}>These drive your recommendations</p>

              <p style={{ fontWeight: 700 }}>Target industries (ranked)</p>
              <ul className="ranked-list">
                {preferences.industries.map((name, i) => (
                  <li className="ranked-list__item" key={name}>
                    <span className="ranked-list__rank">{i + 1}</span>
                    <span className="ranked-list__body">{name}</span>
                    <div className="ranked-list__controls">
                      <button onClick={() => updatePreferences({ industries: move(preferences.industries, i, -1) })}>↑</button>
                      <button onClick={() => updatePreferences({ industries: move(preferences.industries, i, 1) })}>↓</button>
                      <button onClick={() => toggleIndustry(name)}>✕</button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="chip-row">
                {INDUSTRIES.filter((i) => i.name !== "Still figuring it out").map((ind) => (
                  <button
                    key={ind.name}
                    className={`chip-toggle${preferences.industries.includes(ind.name) ? " is-selected" : ""}`}
                    disabled={!preferences.industries.includes(ind.name) && preferences.industries.length >= 3}
                    onClick={() => toggleIndustry(ind.name)}
                  >
                    {ind.name}
                  </button>
                ))}
              </div>

              <p style={{ fontWeight: 700 }}>Target roles</p>
              <div className="chip-row">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    className={`chip-toggle${preferences.roles.includes(role) ? " is-selected" : ""}`}
                    disabled={!preferences.roles.includes(role) && preferences.roles.length >= 5}
                    onClick={() => toggleRole(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <p style={{ fontWeight: 700 }}>Skills</p>
              <p className="meta" style={{ marginTop: "calc(-1 * var(--space-3))" }}>
                Matched against each job's inferred skill profile -- feeds the "relevant skills" line on
                the match checklist.
              </p>
              <div className="chip-row">
                {SKILLS.map((skill) => (
                  <button
                    key={skill}
                    className={`chip-toggle${preferences.skills.includes(skill) ? " is-selected" : ""}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>

              <p style={{ fontWeight: 700 }}>Target locations</p>
              <div className="chip-row">
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    className={`chip-toggle${preferences.locations.includes(loc) ? " is-selected" : ""}`}
                    onClick={() => toggleLocation(loc)}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="relocate"
                  checked={preferences.openToRelocating}
                  onChange={() => updatePreferences({ openToRelocating: !preferences.openToRelocating })}
                />
                <label htmlFor="relocate">Open to relocating</label>
              </div>

              <p style={{ fontWeight: 700, marginTop: "var(--space-5)" }}>Opportunity type</p>
              <div className="tracker-view-toggle" style={{ marginBottom: "var(--space-6)" }}>
                {["Internship", "Full-time", "Both"].map((t) => (
                  <button
                    key={t}
                    className={preferences.opportunityType === t ? "is-active" : ""}
                    onClick={() => updatePreferences({ opportunityType: t })}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <p style={{ fontWeight: 700 }}>Compensation expectation</p>
              <input
                type="range"
                min={15}
                max={60}
                value={preferences.compTarget}
                onChange={(e) => updatePreferences({ compTarget: Number(e.target.value) })}
              />
              <p className="meta" style={{ marginTop: 0 }}>${preferences.compTarget}/hr</p>

              <p style={{ fontWeight: 700 }}>Companies of interest</p>
              <div className="chip-row">
                {COMPANIES.map((c) => (
                  <button
                    key={c.name}
                    className={`chip-toggle${preferences.followedCompanies.includes(c.name) ? " is-selected" : ""}`}
                    onClick={() => toggleCompany(c.name)}
                  >
                    {c.name}
                  </button>
                ))}
                {/* Companies followed via onboarding's free-text "+ Follow" flow
                    (or added below) that aren't in the fixed COMPANIES list --
                    without this, a custom follow would silently disappear from
                    this tab even though it's still a real preference. */}
                {preferences.followedCompanies
                  .filter((name) => !COMPANIES.some((c) => c.name === name))
                  .map((name) => (
                    <button key={name} className="chip-toggle is-selected" onClick={() => toggleCompany(name)}>
                      {name} ✕
                    </button>
                  ))}
              </div>
              <div className="field" style={{ marginTop: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                <input
                  type="text"
                  placeholder="Can't find your company? Type to add it"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !companyQuery.trim()) return;
                    e.preventDefault();
                    if (!preferences.followedCompanies.includes(companyQuery.trim())) toggleCompany(companyQuery.trim());
                    setCompanyQuery("");
                  }}
                />
              </div>
              {companyQuery.trim() &&
                !COMPANIES.some((c) => c.name.toLowerCase() === companyQuery.trim().toLowerCase()) &&
                !preferences.followedCompanies.includes(companyQuery.trim()) && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginBottom: "var(--space-4)" }}
                    onClick={() => {
                      toggleCompany(companyQuery.trim());
                      setCompanyQuery("");
                    }}
                  >
                    + Follow "{companyQuery.trim()}"
                  </button>
                )}

              <p style={{ fontWeight: 700 }}>Recruiting timeline</p>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                {RECRUITING_CYCLES.map((cycle) => (
                  <button
                    key={cycle}
                    className={`chip-toggle${preferences.recruitingCycle === cycle ? " is-selected" : ""}`}
                    onClick={() => updatePreferences({ recruitingCycle: cycle })}
                  >
                    {cycle}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "Recruiting settings" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Recruiting settings</h2>
              <div className="profile-fields-grid">
                {RECRUITING_SETTINGS_COPY.map((s) => (
                  <div className="checkbox-row" key={s.key}>
                    <input
                      type="checkbox"
                      id={s.key}
                      checked={preferences.recruitingSettings[s.key]}
                      onChange={() => updateRecruitingSetting(s.key, !preferences.recruitingSettings[s.key])}
                    />
                    <label htmlFor={s.key}>{s.label}</label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "Privacy" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Privacy</h2>
              <ul className="auth__meta-list">
                <li>Exec sees aggregate interest only — never your individual application list.</li>
                <li>
                  Alumni can see your recruiting status only if "Let alumni see I'm recruiting" is on (Recruiting
                  settings tab).
                </li>
                <li>
                  Coffee chat requests only reach you if "Open to coffee chat requests from members" is on
                  (Recruiting settings tab).
                </li>
                <li>
                  Application outcomes are only added to UC's aggregate recruiting-intelligence data if "Share
                  application outcomes with UC anonymized" is on, and are never tied to your name.
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="detail-rail">
          <div className="avatar-card">
            <div className="avatar-card__avatar">{initialsFromName(form.fullName)}</div>
            <button className="btn-link" onClick={() => setPhotoNote(true)}>
              Change photo
            </button>
            {photoNote && (
              <p className="meta" style={{ marginTop: "var(--space-2)" }}>
                Profile photos aren't supported yet — members are shown by initials for now.
              </p>
            )}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Profile strength</div>
            <div className="strength-percent">{strengthPct}%</div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${strengthPct}%` }} />
            </div>
            <ul className="checklist-simple">
              {strengthChecks.map((c) => (
                <li key={c.label} className={c.done ? "is-checked" : ""}>
                  <span>{c.done ? "✓" : "✕"}</span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">What this changes</div>
            <p style={{ margin: 0 }}>
              These preferences drive your recommended jobs, match scores, suggested alumni, and your odds
              estimate.
            </p>
            <p className="meta" style={{ marginTop: "var(--space-3)" }}>
              Exec sees aggregate interest only — never your applications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
