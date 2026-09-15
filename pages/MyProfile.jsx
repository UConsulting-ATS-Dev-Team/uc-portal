import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { INDUSTRIES, ROLES, SKILLS, LOCATIONS, COMPANIES, RECRUITING_CYCLES } from "../data/careerOptions.js";
import { computeProfileStrength, displayName } from "../data/profileUtils.js";
import { uploadAvatar, removeAvatar } from "../data/avatarSync.js";
import { uploadResume, removeResume, getResumeSignedUrl } from "../data/resumeSync.js";
import {
  fetchOwnWorkHistory,
  addWorkHistoryEntry,
  updateWorkHistoryEntry,
  removeWorkHistoryEntry,
  fetchCompanyInterestCount,
} from "../data/workHistorySync.js";
import Avatar from "../components/Avatar.jsx";
import "../styles/jobDetail.css";
import "../styles/onboarding.css";
import "../styles/tracker.css";
import "../styles/memberProfile.css";
import "../styles/auth.css";
import "../styles/myProfile.css";

const TABS = ["Personal", "Work History", "Career Preferences", "Recruiting Settings", "Privacy"];

const CURRENT_YEAR = new Date().getFullYear();
const WORK_HISTORY_YEARS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i);

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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const avatarInput = useRef(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState(null);
  const [resumeFoundFields, setResumeFoundFields] = useState([]);
  const [workHistory, setWorkHistory] = useState([]);
  const [workHistoryLoading, setWorkHistoryLoading] = useState(true);
  const [workHistoryError, setWorkHistoryError] = useState(null);
  const [editingWorkHistoryId, setEditingWorkHistoryId] = useState(null);
  const [workHistoryForm, setWorkHistoryForm] = useState({ company: "", role: "", startYear: "", current: false, endYear: "" });
  const [interestCounts, setInterestCounts] = useState({});

  useEffect(() => {
    fetchOwnWorkHistory()
      .then(setWorkHistory)
      .catch((err) => setWorkHistoryError(err.message))
      .finally(() => setWorkHistoryLoading(false));
  }, []);
  const [skillQuery, setSkillQuery] = useState("");
  const [industryQuery, setIndustryQuery] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const fileInput = useRef(null);

  const [form, setForm] = useState({
    fullName: displayName(currentUser, profileOverrides),
    classYear: profileOverrides.classYear ?? currentUser.classYear,
    majors: profileOverrides.majors || currentUser.majors,
    ucCommittee: profileOverrides.ucCommittee || currentUser.ucCommittee,
    linkedIn: profileOverrides.linkedIn,
  });

  function handleSaveChanges() {
    const linkedIn = normalizeLinkedInUrl(form.linkedIn);
    setForm((f) => ({ ...f, linkedIn }));
    updateProfileOverrides({
      fullName: form.fullName,
      classYear: form.classYear,
      majors: form.majors,
      ucCommittee: form.ucCommittee,
      linkedIn,
    });
    touchProfileUpdated();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // Applies immediately on choosing a file, unlike the rest of this tab's
  // fields (which wait for "Save changes") -- an image picker with a
  // separate save step is a worse, less expected pattern for this specific
  // kind of control. touchProfileUpdated() so this shows up in
  // profile_last_updated the same as any other real Personal-tab edit.
  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      updateProfileOverrides({ avatarUrl: url });
      touchProfileUpdated();
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      await removeAvatar(profileOverrides.avatarUrl);
      updateProfileOverrides({ avatarUrl: null });
      touchProfileUpdated();
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarUploading(false);
    }
  }

  // The file itself applies immediately (same reasoning as the avatar
  // upload above -- it's genuinely already sitting in Storage the moment
  // it's picked). Parsed fields are different: heuristic text-matching on
  // a freeform resume is meaningfully less reliable than the Directory
  // sheet's structured data, so rather than silently writing them into
  // profileOverrides, they only ever populate this LOCAL, still-editable
  // form state (and only into a field that's currently empty) -- the
  // member reviews them in the actual input boxes and has to click "Save
  // changes" like every other edit on this tab, which doubles as the
  // confirmation step.
  async function handleResumeChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setResumeError(null);
    setResumeFoundFields([]);
    setResumeUploading(true);
    try {
      const { path, fileName, parsed } = await uploadResume(file);
      updateProfileOverrides({ resumeFileName: fileName, resumePath: path });
      touchProfileUpdated();
      const found = [];
      setForm((f) => {
        const next = { ...f };
        if (!next.majors && parsed.majors) {
          next.majors = parsed.majors;
          found.push("Major");
        }
        if (!next.classYear && parsed.classYear) {
          next.classYear = parsed.classYear;
          found.push("Graduation year");
        }
        if (!next.linkedIn && parsed.linkedIn) {
          next.linkedIn = parsed.linkedIn;
          found.push("LinkedIn");
        }
        return next;
      });
      setResumeFoundFields(found);
    } catch (err) {
      setResumeError(err.message);
    } finally {
      setResumeUploading(false);
    }
  }

  async function handleRemoveResume() {
    setResumeError(null);
    setResumeUploading(true);
    try {
      await removeResume(profileOverrides.resumePath);
      updateProfileOverrides({ resumeFileName: null, resumePath: null });
      touchProfileUpdated();
    } catch (err) {
      setResumeError(err.message);
    } finally {
      setResumeUploading(false);
    }
  }

  async function handleViewResume() {
    const url = await getResumeSignedUrl(profileOverrides.resumePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setResumeError("Couldn't open the resume right now — try again.");
  }

  function startAddWorkHistory() {
    setEditingWorkHistoryId("new");
    setWorkHistoryForm({ company: "", role: "", startYear: "", current: false, endYear: "" });
    setWorkHistoryError(null);
  }

  function startEditWorkHistory(entry) {
    setEditingWorkHistoryId(entry.id);
    setWorkHistoryForm({
      company: entry.company,
      role: entry.role || "",
      startYear: entry.start_year || "",
      current: entry.end_year == null,
      endYear: entry.end_year || "",
    });
    setWorkHistoryError(null);
  }

  function cancelWorkHistoryEdit() {
    setEditingWorkHistoryId(null);
  }

  // The real incentive payoff -- fetched once per company, right after a
  // save, rather than for every entry up front (most members will only
  // ever add a couple, so this stays cheap and simple instead of a bulk
  // fetch on mount).
  async function refreshInterestCount(company) {
    const count = await fetchCompanyInterestCount(company);
    setInterestCounts((prev) => ({ ...prev, [company]: count }));
  }

  async function handleSaveWorkHistory() {
    const { company, role, startYear, current, endYear } = workHistoryForm;
    if (!company.trim()) {
      setWorkHistoryError("Company is required.");
      return;
    }
    setWorkHistoryError(null);
    const payload = {
      company,
      role,
      startYear: startYear ? Number(startYear) : null,
      endYear: current ? null : endYear ? Number(endYear) : null,
    };
    try {
      if (editingWorkHistoryId && editingWorkHistoryId !== "new") {
        await updateWorkHistoryEntry(editingWorkHistoryId, payload);
      } else {
        await addWorkHistoryEntry(payload);
      }
      const fresh = await fetchOwnWorkHistory();
      setWorkHistory(fresh);
      setEditingWorkHistoryId(null);
      refreshInterestCount(payload.company.trim());
    } catch (err) {
      setWorkHistoryError(err.message);
    }
  }

  async function handleRemoveWorkHistory(id) {
    try {
      await removeWorkHistoryEntry(id);
      setWorkHistory((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setWorkHistoryError(err.message);
    }
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

  const { checks: strengthChecks, pct: strengthPct } = computeProfileStrength(
    preferences,
    form.linkedIn,
    profileOverrides.resumePath
  );

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
          {/* No self-view preview mode exists -- pages/MemberProfile.jsx
              only ever renders *other* members (route is /network/:id,
              no route for viewing your own record through that lens).
              Real feature work, not a quick wire-up, so honestly inert
              for now rather than faked. */}
          <button className="btn btn-secondary" disabled title="Not built yet -- there's no self-view preview mode in this prototype">
            View as others see it
          </button>
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
                  <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                    <span className="meta">
                      {resumeUploading
                        ? "Uploading…"
                        : profileOverrides.resumeFileName || "No resume uploaded"}
                    </span>
                    {profileOverrides.resumePath && !resumeUploading && (
                      <button className="btn-link" type="button" onClick={handleViewResume}>
                        View
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={resumeUploading}
                      onClick={() => fileInput.current?.click()}
                    >
                      {profileOverrides.resumePath ? "Replace" : "Upload"}
                    </button>
                    {profileOverrides.resumePath && !resumeUploading && (
                      <button className="btn-link" type="button" onClick={handleRemoveResume}>
                        Remove
                      </button>
                    )}
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      style={{ display: "none" }}
                      onChange={handleResumeChange}
                    />
                  </div>
                  {resumeError && (
                    <p className="meta" style={{ marginTop: "var(--space-2)", color: "#B3261E" }}>
                      {resumeError}
                    </p>
                  )}
                  {resumeFoundFields.length > 0 && (
                    <p className="meta" style={{ marginTop: "var(--space-2)" }}>
                      Found in your resume and filled in below: {resumeFoundFields.join(", ")} — double-check before
                      saving.
                    </p>
                  )}
                  <p className="meta" style={{ marginTop: "var(--space-2)" }}>
                    PDF or Word (.docx). Private to you — never shown to other members.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "Work History" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Work History</h2>
              <p className="meta" style={{ marginTop: "calc(-1 * var(--space-4))" }}>
                Your own past roles, self-reported — never pulled from LinkedIn or anywhere else. Visible to other UC
                members so they can find real referral/insight connections before they apply somewhere.
              </p>

              {workHistory.length === 0 && !workHistoryLoading && editingWorkHistoryId !== "new" && (
                <div className="empty-state" style={{ marginBottom: "var(--space-5)" }}>
                  <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>
                    You haven't added any work history yet
                  </p>
                  <p className="meta">
                    Other members can't see where you've worked until you add it — even one entry helps someone
                    considering the same company.
                  </p>
                </div>
              )}

              {workHistory.map((entry) => (
                <div className="experience-row" key={entry.id} style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="experience-row__title">{entry.company}</div>
                    <div className="experience-row__meta">
                      {entry.role ? `${entry.role} · ` : ""}
                      {entry.start_year || "—"}–{entry.end_year || "Present"}
                    </div>
                    {interestCounts[entry.company] !== undefined && (
                      <p className="meta" style={{ marginTop: "var(--space-2)" }}>
                        {interestCounts[entry.company] > 0
                          ? `${interestCounts[entry.company]} member${interestCounts[entry.company] === 1 ? "" : "s"} ${
                              interestCounts[entry.company] === 1 ? "is" : "are"
                            } interested in ${entry.company} right now.`
                          : `No members have ${entry.company} on their radar yet — you might be the first insight they get.`}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-3)", flexShrink: 0 }}>
                    <button className="btn-link" onClick={() => startEditWorkHistory(entry)}>
                      Edit
                    </button>
                    <button className="btn-link" onClick={() => handleRemoveWorkHistory(entry.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {editingWorkHistoryId ? (
                <div className="field-group" style={{ marginTop: "var(--space-5)" }}>
                  <div className="field">
                    <label>Company</label>
                    <input
                      type="text"
                      value={workHistoryForm.company}
                      onChange={(e) => setWorkHistoryForm((f) => ({ ...f, company: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Role (optional)</label>
                    <input
                      type="text"
                      value={workHistoryForm.role}
                      onChange={(e) => setWorkHistoryForm((f) => ({ ...f, role: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Start year</label>
                    <select
                      value={workHistoryForm.startYear}
                      onChange={(e) => setWorkHistoryForm((f) => ({ ...f, startYear: e.target.value }))}
                    >
                      <option value="">—</option>
                      {WORK_HISTORY_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <input
                      type="checkbox"
                      checked={workHistoryForm.current}
                      onChange={(e) => setWorkHistoryForm((f) => ({ ...f, current: e.target.checked }))}
                    />
                    Currently here
                  </label>
                  {!workHistoryForm.current && (
                    <div className="field">
                      <label>End year</label>
                      <select
                        value={workHistoryForm.endYear}
                        onChange={(e) => setWorkHistoryForm((f) => ({ ...f, endYear: e.target.value }))}
                      >
                        <option value="">—</option>
                        {WORK_HISTORY_YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {workHistoryError && (
                    <p className="meta" style={{ color: "#B3261E" }}>
                      {workHistoryError}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <button className="btn btn-primary" onClick={handleSaveWorkHistory}>
                      Save
                    </button>
                    <button className="btn btn-secondary" onClick={cancelWorkHistoryEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-secondary" onClick={startAddWorkHistory}>
                  + Add work history
                </button>
              )}
            </div>
          )}

          {tab === "Career Preferences" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Career Preferences</h2>
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
                {Array.from({ length: 3 - preferences.industries.length }).map((_, i) => (
                  <li className="ranked-list__empty-slot" key={`empty-${i}`}>
                    <span className="ranked-list__rank">{preferences.industries.length + i + 1}</span>
                    Open slot — pick another below
                  </li>
                ))}
              </ul>
              <input
                type="text"
                placeholder="Search industries…"
                value={industryQuery}
                onChange={(e) => setIndustryQuery(e.target.value)}
                style={{ marginBottom: "var(--space-3)" }}
              />
              <div className="chip-row">
                {INDUSTRIES.filter((i) => i.name !== "Still figuring it out")
                  .filter((ind) => preferences.industries.includes(ind.name) || ind.name.toLowerCase().includes(industryQuery.trim().toLowerCase()))
                  .map((ind) => (
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
              <input
                type="text"
                placeholder="Search roles…"
                value={roleQuery}
                onChange={(e) => setRoleQuery(e.target.value)}
                style={{ marginBottom: "var(--space-3)" }}
              />
              <div className="chip-row">
                {ROLES.filter((role) => preferences.roles.includes(role) || role.toLowerCase().includes(roleQuery.trim().toLowerCase())).map(
                  (role) => (
                    <button
                      key={role}
                      className={`chip-toggle${preferences.roles.includes(role) ? " is-selected" : ""}`}
                      disabled={!preferences.roles.includes(role) && preferences.roles.length >= 5}
                      onClick={() => toggleRole(role)}
                    >
                      {role}
                    </button>
                  )
                )}
              </div>

              <p style={{ fontWeight: 700 }}>Skills</p>
              <p className="meta" style={{ marginTop: "calc(-1 * var(--space-3))" }}>
                Matched against each job's inferred skill profile -- feeds the "relevant skills" line on
                the match checklist.
              </p>
              <input
                type="text"
                placeholder={`Search ${SKILLS.length} skills…`}
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
                style={{ marginBottom: "var(--space-3)" }}
              />
              <div className={`chip-row${showAllSkills ? "" : " chip-row--collapsed"}`}>
                {SKILLS.filter(
                  (skill) => preferences.skills.includes(skill) || skill.toLowerCase().includes(skillQuery.trim().toLowerCase())
                ).map((skill) => (
                  <button
                    key={skill}
                    className={`chip-toggle${preferences.skills.includes(skill) ? " is-selected" : ""}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
                {SKILLS.every(
                  (skill) => !preferences.skills.includes(skill) && !skill.toLowerCase().includes(skillQuery.trim().toLowerCase())
                ) && <p className="meta">No skills match "{skillQuery}".</p>}
              </div>
              <button className="btn-link" style={{ marginBottom: "var(--space-6)" }} onClick={() => setShowAllSkills((v) => !v)}>
                {showAllSkills ? "Show fewer" : "Show more"}
              </button>

              <p style={{ fontWeight: 700 }}>Target locations</p>
              <input
                type="text"
                placeholder="Search locations…"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                style={{ marginBottom: "var(--space-3)" }}
              />
              <div className={`chip-row${showAllLocations ? "" : " chip-row--collapsed"}`}>
                {LOCATIONS.filter((loc) => preferences.locations.includes(loc) || loc.toLowerCase().includes(locationQuery.trim().toLowerCase())).map(
                  (loc) => (
                    <button
                      key={loc}
                      className={`chip-toggle${preferences.locations.includes(loc) ? " is-selected" : ""}`}
                      onClick={() => toggleLocation(loc)}
                    >
                      {loc}
                    </button>
                  )
                )}
              </div>
              <button className="btn-link" style={{ marginBottom: "var(--space-6)" }} onClick={() => setShowAllLocations((v) => !v)}>
                {showAllLocations ? "Show fewer" : "Show more"}
              </button>
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
                max={75}
                value={preferences.compTarget}
                onChange={(e) => updatePreferences({ compTarget: Number(e.target.value) })}
              />
              <p className="meta" style={{ marginTop: 0 }}>
                ${preferences.compTarget}/hr (~${(preferences.compTarget * 2080).toLocaleString()}/yr at full-time hours)
              </p>

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

          {tab === "Recruiting Settings" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Recruiting Settings</h2>
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
                  (Recruiting Settings tab).
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
            <div className="avatar-card__avatar">
              <Avatar name={form.fullName} url={profileOverrides.avatarUrl} />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn-link" disabled={avatarUploading} onClick={() => avatarInput.current?.click()}>
                {avatarUploading ? "Uploading…" : profileOverrides.avatarUrl ? "Change photo" : "Add photo"}
              </button>
              {profileOverrides.avatarUrl && (
                <button className="btn-link" disabled={avatarUploading} onClick={handleRemoveAvatar}>
                  Remove
                </button>
              )}
            </div>
            <input
              ref={avatarInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
            {avatarError && (
              <p className="meta" style={{ marginTop: "var(--space-2)", color: "#B3261E" }}>
                {avatarError}
              </p>
            )}
            <p className="meta" style={{ marginTop: "var(--space-2)" }}>
              Visible to other UC members once uploaded.
            </p>
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
        </div>
      </div>
    </div>
  );
}
