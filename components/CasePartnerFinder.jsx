import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../data/store.jsx";
import {
  fetchMyPoolStatus,
  joinCasePartnerPool,
  leaveCasePartnerPool,
  fetchCandidates,
  fetchMyRequests,
  resolveDisplayNames,
  respondToRequest,
  cancelRequest,
} from "../data/casePartners.js";
import RequestCasePartnerModal from "./modals/RequestCasePartnerModal.jsx";
import Skeleton from "./Skeleton.jsx";

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("");
}

function overlapCount(a = [], b = []) {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x)).length;
}

// Career Resources' "Find a case partner" section (see
// JOB_ENGINE_ARCHITECTURE.md's dated entry for the full design writeup).
// Lives here rather than Network because case practice is fundamentally
// education-hub territory -- practicing with someone who's also currently
// recruiting, not the alumni-directory/informational-interview use case
// Network's filtering machinery is built around -- and because the real
// matching signal (industries/roles/recruitingCycle) comes from
// member_preferences, not the `people` directory Network/Member profile
// read from.
//
// CRITICAL constraint (direct from the person who asked for this): nobody
// is ever paired automatically. This component only ever calls
// joinCasePartnerPool() (an explicit opt-in click) and sendRequest() (an
// explicit per-person click) -- never anything that creates or accepts a
// pairing on a member's behalf. A "match" (an accepted request) only ever
// appears here because the OTHER member clicked Accept themselves; see
// data/casePartners.js and the case_partner_requests RLS policies
// (20260902140000_case_partner_matching.sql) for how that's enforced
// structurally, not just by this component's own restraint.
export default function CasePartnerFinder() {
  const { preferences } = useAppState();
  const [status, setStatus] = useState({ signedIn: null, optedIn: false });
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [requests, setRequests] = useState({ sent: [], received: [] });
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [requestModalCandidate, setRequestModalCandidate] = useState(null);

  async function loadPoolView() {
    const [candidateRows, requestRows] = await Promise.all([fetchCandidates(), fetchMyRequests()]);
    setCandidates(candidateRows);
    setRequests(requestRows);
    const otherIds = [...requestRows.sent, ...requestRows.received].map((r) =>
      r.requester_id === requestRows.myId ? r.recipient_id : r.requester_id
    );
    if (otherIds.length > 0) {
      const resolved = await resolveDisplayNames(otherIds);
      setNames(resolved);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const poolStatus = await fetchMyPoolStatus();
        if (cancelled) return;
        setStatus(poolStatus);
        if (poolStatus.optedIn) await loadPoolView();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const scoreA = overlapCount(a.industries, preferences.industries) * 2 + overlapCount(a.roles, preferences.roles);
      const scoreB = overlapCount(b.industries, preferences.industries) * 2 + overlapCount(b.roles, preferences.roles);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(a.optedInAt) - new Date(b.optedInAt);
    });
  }, [candidates, preferences.industries, preferences.roles]);

  const pendingReceived = requests.received.filter((r) => r.status === "pending");
  const otherPending = requests.sent.filter((r) => r.status === "pending");
  const accepted = [...requests.sent, ...requests.received].filter((r) => r.status === "accepted");
  const requestedIds = new Set([...requests.sent].map((r) => r.recipient_id));

  async function handleJoin() {
    setBusy(true);
    setError(null);
    try {
      await joinCasePartnerPool();
      setStatus({ signedIn: true, optedIn: true });
      await loadPoolView();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    setError(null);
    try {
      await leaveCasePartnerPool();
      setStatus({ signedIn: true, optedIn: false });
      setCandidates([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(requestId, accept) {
    setBusy(true);
    setError(null);
    try {
      await respondToRequest(requestId, accept);
      await loadPoolView();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(requestId) {
    setBusy(true);
    setError(null);
    try {
      await cancelRequest(requestId);
      await loadPoolView();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <h2>Find a case partner</h2>
        <Skeleton lines={3} />
      </>
    );
  }

  if (!status.signedIn) {
    return (
      <>
        <h2>Find a case partner</h2>
        <p className="meta">Sign in to opt into the case partner pool and send requests.</p>
      </>
    );
  }

  return (
    <>
      <h2>Find a case partner</h2>
      {error && <p className="meta" style={{ color: "var(--color-danger, #b3261e)" }}>{error}</p>}

      {!status.optedIn ? (
        <div className="rail-card is-accent">
          <div className="rail-card__title">Practice cases with another UC member</div>
          <p className="meta" style={{ marginBottom: "var(--space-4)" }}>
            Moved from the club's manual "Case Partners" spreadsheet into the app. Opting in lists you as available and lets
            you browse other opted-in members filtered by your target industries, roles, and recruiting timeline -- nobody
            is ever paired automatically. You send a request, they accept it, and only then are you matched.
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={handleJoin}>
            {busy ? "Joining…" : "Join the case partner pool"}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <p className="meta" style={{ margin: 0 }}>
              You're in the pool -- {candidates.length} other member{candidates.length === 1 ? "" : "s"} opted in.
            </p>
            <button className="btn btn-secondary" disabled={busy} onClick={handleLeave}>
              Leave pool
            </button>
          </div>

          {pendingReceived.length > 0 && (
            <div className="rail-card is-accent" style={{ marginBottom: "var(--space-5)" }}>
              <div className="rail-card__title">Requests waiting on you ({pendingReceived.length})</div>
              {pendingReceived.map((r) => (
                <div className="chat-status-row" key={r.id}>
                  <div>
                    <div>{names[r.requester_id] || "A UC member"}</div>
                    {r.note && <div className="meta">"{r.note}"</div>}
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => handleRespond(r.id, false)}>
                      Decline
                    </button>
                    <button className="btn btn-primary" disabled={busy} onClick={() => handleRespond(r.id, true)}>
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginBottom: "var(--space-3)" }}>Browse case partners</h3>
          {ranked.length === 0 ? (
            <p className="meta">No other members have opted in yet -- check back once more members join the pool.</p>
          ) : (
            <div className="resource-card-grid">
              {ranked.map((c) => {
                const overlap = overlapCount(c.industries, preferences.industries);
                const alreadyRequested = requestedIds.has(c.memberId);
                return (
                  <div className="person-card" key={c.memberId}>
                    <div className="person-card__avatar">{initials(c.displayName)}</div>
                    <div className="person-card__name">{c.displayName}</div>
                    <div className="person-card__meta">
                      {c.industries.length > 0 ? c.industries.join(", ") : "No target industries set"}
                    </div>
                    {c.recruitingCycle && <div className="person-card__meta">{c.recruitingCycle}</div>}
                    {overlap > 0 && <span className="chip chip-accent">{overlap} shared industr{overlap === 1 ? "y" : "ies"}</span>}
                    <div className="person-card__actions">
                      <button
                        className="btn btn-primary"
                        disabled={alreadyRequested}
                        onClick={() => setRequestModalCandidate(c)}
                      >
                        {alreadyRequested ? "Request sent" : "Request case partner"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h3 style={{ margin: "var(--space-6) 0 var(--space-3)" }}>My case partners</h3>
          {accepted.length === 0 && otherPending.length === 0 ? (
            <p className="meta">No requests sent yet -- browse above and send your first one.</p>
          ) : (
            <>
              {accepted.map((r) => {
                const otherId = r.requester_id === requests.myId ? r.recipient_id : r.requester_id;
                return (
                  <div className="chat-status-row" key={r.id}>
                    <span>{names[otherId] || "A UC member"}</span>
                    <span className="chat-status-row__status">Matched</span>
                  </div>
                );
              })}
              {otherPending.map((r) => (
                <div className="chat-status-row" key={r.id}>
                  <span>{names[r.recipient_id] || "A UC member"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span className="chat-status-row__status">Request sent</span>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => handleCancel(r.id)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {requestModalCandidate && (
        <RequestCasePartnerModal
          candidate={requestModalCandidate}
          onClose={() => setRequestModalCandidate(null)}
          onSent={loadPoolView}
        />
      )}
    </>
  );
}
