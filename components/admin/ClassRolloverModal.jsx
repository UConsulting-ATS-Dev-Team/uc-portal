import { useMemo, useState } from "react";
import { applyClassRollover } from "../../data/adminToolsSync.js";
import Modal from "../Modal.jsx";
import "../../styles/adminTools.css";

// Moves a graduating class from current member to alumni in one reviewed step. Shows exactly who, lets the admin uncheck anyone,
// and only touches people who are still current members of that class when it runs.
export default function ClassRolloverModal({ accounts, onClose, onDone }) {
  const members = useMemo(() => accounts.filter((a) => a.member_status === "current_member" && !a.deactivated_at && a.class_year), [accounts]);
  const years = useMemo(() => [...new Set(members.map((a) => a.class_year))].sort(), [members]);
  const [year, setYear] = useState(years[0] ?? "");
  const inClass = useMemo(() => members.filter((a) => String(a.class_year) === String(year)).sort((a, b) => a.display_name.localeCompare(b.display_name)), [members, year]);
  // Admins stay unchecked until someone ticks them: an admin who becomes an alumnus is an unusual thing to do by accident.
  const [unchecked, setUnchecked] = useState(null);
  const skipped = unchecked ?? new Set(inClass.filter((a) => a.role === "admin").map((a) => a.member_id));
  const chosen = inClass.filter((a) => !skipped.has(a.member_id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function toggle(id) {
    const next = new Set(skipped);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setUnchecked(next);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const moved = await applyClassRollover(chosen.map((a) => a.member_id), Number(year));
      setResult(moved);
      await onDone();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <Modal
      title="Class rollover"
      onClose={() => !busy && onClose()}
      width={560}
      footer={
        result !== null ? (
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={run} disabled={busy || chosen.length === 0}>
              {busy ? "Moving…" : `Move ${chosen.length} to alumni`}
            </button>
          </>
        )
      }
    >
      {result !== null ? (
        <p style={{ marginTop: 0 }}>
          Moved {result} {result === 1 ? "person" : "people"} from the class of {year} to alumni.
        </p>
      ) : years.length === 0 ? (
        <p style={{ marginTop: 0 }}>No current members have a class year yet.</p>
      ) : (
        <>
          <p className="meta" style={{ marginTop: 0 }}>
            Pick the graduating class and who to move. Alumni sign in to Feed, Network and Companies instead of Jobs and Applications. You can change anyone back from their card.
          </p>
          {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
          <div className="field">
            <label htmlFor="rollover-year">Class</label>
            <select
              id="rollover-year"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setUnchecked(null);
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  Class of {y} ({members.filter((a) => a.class_year === y).length})
                </option>
              ))}
            </select>
          </div>
          <ul className="rollover-list">
            {inClass.map((a) => (
              <li key={a.member_id}>
                <label>
                  <input type="checkbox" checked={!skipped.has(a.member_id)} onChange={() => toggle(a.member_id)} />
                  <span>{a.display_name}</span>
                  {a.role === "admin" && <span className="chip">Admin</span>}
                  <span className="meta">{a.email}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
