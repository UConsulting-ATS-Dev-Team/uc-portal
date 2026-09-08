import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../data/store.jsx";
import { currentUser } from "../data/mockUser.js";
import { displayName, resolvedClassYear, resolvedMajors, resolvedUcCommittee } from "../data/profileUtils.js";
import {
  INDUSTRIES,
  ROLES,
  LOCATIONS,
  COMPANIES,
  RECRUITING_CYCLES,
  HELP_OPTIONS,
  computeMatches,
} from "../data/careerOptions.js";
import "../styles/onboarding.css";

const STEPS = ["You", "Industries", "Roles & locations", "Companies", "Timeline"];

function move(list, index, direction) {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function Brand() {
  return (
    <div className="auth__brand" style={{ marginBottom: "var(--space-2)" }}>
      <span className="auth__mark">
        U<span>C</span>
      </span>
      <span className="auth__wordmark">UC Portal</span>
    </div>
  );
}

function StepYou({ resumeName, onAttach }) {
  const fileInput = useRef(null);
  const { profileOverrides } = useAppState();
  return (
    <>
      <div className="onboarding__kicker">Step 1 of 5</div>
      <h1 className="onboarding__title">Confirm your info</h1>
      <p className="onboarding__subtitle">
        Pulled from the UC roster — let us know if anything's out of date at a GM.
      </p>
      <ul className="auth__meta-list">
        <li>{displayName(currentUser, profileOverrides)}</li>
        <li>Class of {resolvedClassYear(currentUser, profileOverrides)}</li>
        <li>{resolvedMajors(currentUser, profileOverrides) || "Business Economics, Data Science"}</li>
        <li>{resolvedUcCommittee(currentUser, profileOverrides) || "Careers Committee"}</li>
      </ul>
      <div
        onClick={() => fileInput.current?.click()}
        style={{
          border: "1px dashed var(--color-border)",
          padding: "var(--space-7)",
          textAlign: "center",
          color: "var(--color-text-muted)",
          cursor: "pointer",
        }}
      >
        {resumeName ? `Attached: ${resumeName}` : "Drop your resume here (optional) — it pre-fills later steps"}
        <input
          ref={fileInput}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => onAttach(e.target.files?.[0]?.name)}
        />
      </div>
    </>
  );
}

function StepIndustries({ industries, onToggle, onReorder }) {
  return (
    <>
      <div className="onboarding__kicker">Step 2 of 5</div>
      <h1 className="onboarding__title">Pick up to 3 industries</h1>
      <p className="onboarding__subtitle">Ranked — put what you care about most first.</p>

      <ul className="ranked-list">
        {industries.map((name, i) => {
          const info = INDUSTRIES.find((ind) => ind.name === name);
          return (
            <li className="ranked-list__item" key={name}>
              <span className="ranked-list__rank">{i + 1}</span>
              <div className="ranked-list__body">
                <div className="ranked-list__name">{name}</div>
                {info && info.members > 0 && (
                  <div className="ranked-list__meta">
                    {info.members} members · {info.alumni} alumni
                  </div>
                )}
              </div>
              <div className="ranked-list__controls">
                <button type="button" onClick={() => onReorder(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => onReorder(i, 1)} aria-label="Move down">
                  ↓
                </button>
                <button type="button" onClick={() => onToggle(name)} aria-label="Remove">
                  ✕
                </button>
              </div>
            </li>
          );
        })}
        {industries.length < 3 && <li className="ranked-list__empty-slot">Open slot — pick another below</li>}
      </ul>

      <div className="chip-row">
        {INDUSTRIES.map((ind) => {
          const selected = industries.includes(ind.name);
          return (
            <button
              type="button"
              key={ind.name}
              className={`chip-toggle${selected ? " is-selected" : ""}`}
              disabled={!selected && industries.length >= 3}
              onClick={() => onToggle(ind.name)}
            >
              {ind.name}
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepRoles({ preferences, onToggleRole, onToggleLocation, onToggleFlag }) {
  const matches = computeMatches(preferences);
  return (
    <>
      <div className="onboarding__kicker">Step 3 of 5</div>
      <h1 className="onboarding__title">Roles & locations</h1>
      <p className="onboarding__subtitle">Suggested based on your industries — pick up to 5 roles.</p>

      <div className="chip-row">
        {ROLES.map((role) => {
          const selected = preferences.roles.includes(role);
          return (
            <button
              type="button"
              key={role}
              className={`chip-toggle${selected ? " is-selected" : ""}`}
              disabled={!selected && preferences.roles.length >= 5}
              onClick={() => onToggleRole(role)}
            >
              {role}
            </button>
          );
        })}
      </div>

      <div className="chip-row">
        {LOCATIONS.map((loc) => (
          <button
            type="button"
            key={loc}
            className={`chip-toggle${preferences.locations.includes(loc) ? " is-selected" : ""}`}
            onClick={() => onToggleLocation(loc)}
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
          onChange={() => onToggleFlag("openToRelocating")}
        />
        <label htmlFor="relocate">Open to relocating</label>
      </div>
      <div className="checkbox-row" style={{ marginBottom: "var(--space-6)" }}>
        <input
          type="checkbox"
          id="remoteOnly"
          checked={preferences.remoteOrHybridOnly}
          onChange={() => onToggleFlag("remoteOrHybridOnly")}
        />
        <label htmlFor="remoteOnly">Only show me hybrid or remote</label>
      </div>

      <div className="payoff-card">
        Your answers already match <span className="payoff-card__numbers">{matches.roles}</span> open roles
        and <span className="payoff-card__numbers">{matches.alumni}</span> UC alumni.
      </div>
    </>
  );
}

function StepCompanies({ followed, onToggleFollow }) {
  const [query, setQuery] = useState("");
  const filtered = COMPANIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = filtered.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <>
      <div className="onboarding__kicker">Step 4 of 5</div>
      <h1 className="onboarding__title">Companies</h1>
      <p className="onboarding__subtitle">Suggested by UC alumni presence — follow the ones you're tracking.</p>

      <div className="field">
        <input
          type="text"
          placeholder="Search to follow a company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.map((c) => {
        const isFollowed = followed.includes(c.name);
        return (
          <div className="company-row" key={c.name}>
            <div>
              <div className="ranked-list__name">{c.name}</div>
              <div className="company-row__meta">
                {c.alumni} UC alumni · {c.openRoles} open roles
              </div>
            </div>
            <button
              type="button"
              className={`btn ${isFollowed ? "btn-secondary" : "btn-primary"}`}
              onClick={() => onToggleFollow(c.name)}
            >
              {isFollowed ? "Following" : "Follow"}
            </button>
          </div>
        );
      })}

      {query.trim() && !exactMatch && (
        <div className="company-row">
          <div className="ranked-list__name">{query.trim()}</div>
          <button type="button" className="btn btn-secondary" onClick={() => onToggleFollow(query.trim())}>
            + Follow
          </button>
        </div>
      )}
    </>
  );
}

function StepTimeline({ preferences, onSetCycle, onToggleHelp, onToggleFlag }) {
  return (
    <>
      <div className="onboarding__kicker">Step 5 of 5</div>
      <h1 className="onboarding__title">Timeline</h1>
      <p className="onboarding__subtitle">What's your recruiting cycle, and what would help most right now?</p>

      <div className="chip-row">
        {RECRUITING_CYCLES.map((cycle) => (
          <button
            type="button"
            key={cycle}
            className={`chip-toggle${preferences.recruitingCycle === cycle ? " is-selected" : ""}`}
            onClick={() => onSetCycle(cycle)}
          >
            {cycle}
          </button>
        ))}
      </div>

      <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>What would help most right now?</p>
      {HELP_OPTIONS.map((opt) => (
        <div className="checkbox-row" key={opt}>
          <input
            type="checkbox"
            id={opt}
            checked={preferences.helpNeeded.includes(opt)}
            onChange={() => onToggleHelp(opt)}
          />
          <label htmlFor={opt}>{opt}</label>
        </div>
      ))}

      <div className="checkbox-row" style={{ marginTop: "var(--space-6)" }}>
        <input
          type="checkbox"
          id="reminders"
          checked={preferences.remindersEnabled}
          onChange={() => onToggleFlag("remindersEnabled")}
        />
        <label htmlFor="reminders">Remind me about deadlines and events</label>
      </div>
    </>
  );
}

function Completion({ preferences, onFinish }) {
  const matches = computeMatches(preferences);
  const tracksQueued = Math.max(1, preferences.helpNeeded.length);
  const featuredCompany = preferences.followedCompanies[0] || COMPANIES[0].name;
  const featuredIndustry = preferences.industries[0] || "your target industry";
  const featuredHelp = preferences.helpNeeded[0] || "Case Interview Track";

  return (
    <>
      <h1 className="onboarding__title">You're set up, {currentUser.firstName}</h1>
      <p className="onboarding__subtitle">Here's what's already waiting for you.</p>

      <div className="completion__stats">
        <div className="completion__stat">
          <div className="completion__stat-number">{matches.roles}</div>
          <div className="completion__stat-label">matched roles</div>
        </div>
        <div className="completion__stat">
          <div className="completion__stat-number">{matches.alumni}</div>
          <div className="completion__stat-label">alumni to meet</div>
        </div>
        <div className="completion__stat">
          <div className="completion__stat-number">{tracksQueued}</div>
          <div className="completion__stat-label">learning tracks queued</div>
        </div>
        <div className="completion__stat">
          <div className="completion__stat-number">5</div>
          <div className="completion__stat-label">deadlines this month</div>
        </div>
      </div>

      <ul className="completion__actions">
        <li>Your earliest matched deadline is at {featuredCompany} — worth a look this week.</li>
        <li>Meet a UC alum in {featuredIndustry} — {matches.alumni} are one message away.</li>
        <li>Start the {featuredHelp} track in Career Resources.</li>
      </ul>

      <p className="field-note" style={{ marginTop: 0 }}>
        We'll ask you to re-confirm your interests each quarter at a GM so recommendations stay accurate.
      </p>

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={onFinish}>
        Go to my dashboard
      </button>
    </>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [resumeName, setResumeName] = useState(null);
  const { preferences, updatePreferences, completeOnboarding } = useAppState();
  const navigate = useNavigate();

  function toggleIndustry(name) {
    const already = preferences.industries.includes(name);
    if (already) {
      updatePreferences({ industries: preferences.industries.filter((n) => n !== name) });
    } else if (preferences.industries.length < 3) {
      updatePreferences({ industries: [...preferences.industries, name] });
    }
  }

  function reorderIndustry(index, direction) {
    updatePreferences({ industries: move(preferences.industries, index, direction) });
  }

  function toggleRole(role) {
    const already = preferences.roles.includes(role);
    if (already) {
      updatePreferences({ roles: preferences.roles.filter((r) => r !== role) });
    } else if (preferences.roles.length < 5) {
      updatePreferences({ roles: [...preferences.roles, role] });
    }
  }

  function toggleLocation(loc) {
    const already = preferences.locations.includes(loc);
    updatePreferences({
      locations: already ? preferences.locations.filter((l) => l !== loc) : [...preferences.locations, loc],
    });
  }

  function toggleFlag(key) {
    updatePreferences({ [key]: !preferences[key] });
  }

  function toggleFollow(name) {
    const already = preferences.followedCompanies.includes(name);
    updatePreferences({
      followedCompanies: already
        ? preferences.followedCompanies.filter((c) => c !== name)
        : [...preferences.followedCompanies, name],
    });
  }

  function toggleHelp(opt) {
    const already = preferences.helpNeeded.includes(opt);
    updatePreferences({
      helpNeeded: already ? preferences.helpNeeded.filter((h) => h !== opt) : [...preferences.helpNeeded, opt],
    });
  }

  function handleAttachResume(name) {
    if (!name) return;
    setResumeName(name);
    updatePreferences({ resumeAttached: true });
  }

  function handleFinish() {
    completeOnboarding();
    navigate("/");
  }

  function saveAndFinishLater() {
    navigate("/");
  }

  if (showCompletion) {
    return (
      <div className="onboarding">
        <div className="onboarding__content" style={{ marginTop: "var(--space-8)" }}>
          <Brand />
          <Completion preferences={preferences} onFinish={handleFinish} />
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="onboarding__header">
        <div className="onboarding__progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`onboarding__segment${i < step ? " is-complete" : ""}${i === step ? " is-current" : ""}`}
            />
          ))}
        </div>
        <button className="btn-link" onClick={saveAndFinishLater}>
          Save & finish later
        </button>
      </div>

      <div className="onboarding__content">
        {step === 0 && <StepYou resumeName={resumeName} onAttach={handleAttachResume} />}
        {step === 1 && (
          <StepIndustries industries={preferences.industries} onToggle={toggleIndustry} onReorder={reorderIndustry} />
        )}
        {step === 2 && (
          <StepRoles
            preferences={preferences}
            onToggleRole={toggleRole}
            onToggleLocation={toggleLocation}
            onToggleFlag={toggleFlag}
          />
        )}
        {step === 3 && <StepCompanies followed={preferences.followedCompanies} onToggleFollow={toggleFollow} />}
        {step === 4 && (
          <StepTimeline
            preferences={preferences}
            onSetCycle={(cycle) => updatePreferences({ recruitingCycle: cycle })}
            onToggleHelp={toggleHelp}
            onToggleFlag={toggleFlag}
          />
        )}
      </div>

      <div className="onboarding__footer">
        <button className="btn btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        <span className="onboarding__step-count">
          Step {step + 1} of {STEPS.length}
        </span>
        <button
          className="btn btn-primary"
          onClick={() => (step === STEPS.length - 1 ? setShowCompletion(true) : setStep((s) => s + 1))}
        >
          {step === STEPS.length - 1 ? "Finish" : "Continue"}
        </button>
      </div>
    </div>
  );
}
