import { useState } from "react";
import { Link } from "react-router-dom";
import PostOpportunityModal from "../components/modals/PostOpportunityModal.jsx";
import {
  KPIS,
  INDUSTRY_INTEREST,
  biggestGap,
  CLASS_YEAR_BREAKDOWN,
  MOST_TARGETED_COMPANIES,
  MEMBER_ENGAGEMENT,
  ACCESS_CONTROL,
  FLAGGED_FEED_POSTS,
} from "../data/mockAdmin.js";
import { useAppState } from "../data/store.jsx";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/network.css";
import "../styles/resources.css";
import "../styles/admin.css";

export default function AdminDashboard() {
  const { opportunityQueue, approveOpportunity, removeOpportunity } = useAppState();
  const [showPostModal, setShowPostModal] = useState(false);
  const gap = biggestGap();
  const maxMembers = Math.max(...INDUSTRY_INTEREST.map((i) => i.members));

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1>Admin Dashboard</h1>
          <p className="meta">Aggregate interest and engagement — never an individual member's application list.</p>
        </div>
        <div className="jobs-header__actions">
          <select defaultValue="Fall 2026">
            <option>Fall 2026</option>
            <option>Spring 2026</option>
          </select>
          <button className="btn btn-secondary">Export report</button>
          <button className="btn btn-primary" onClick={() => setShowPostModal(true)}>+ Post opportunity</button>
        </div>
      </div>

      <div className="admin-kpi-strip">
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.activeMembers}</div>
          <div className="admin-kpi-cell__label">Active members</div>
          <div className="admin-kpi-cell__change">+{KPIS.activeMembersChange} vs last quarter</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.profilesUpToDatePct}%</div>
          <div className="admin-kpi-cell__label">Profiles up to date</div>
          <div className="admin-kpi-cell__change">{KPIS.staleProfiles} stale</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.applicationsTracked}</div>
          <div className="admin-kpi-cell__label">Applications tracked</div>
          <div className="admin-kpi-cell__change">{KPIS.applicationsPerMember} per member</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.coffeeChatsBooked}</div>
          <div className="admin-kpi-cell__label">Coffee chats booked</div>
          <div className="admin-kpi-cell__change">+{KPIS.coffeeChatsChange} vs last cycle</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.offersReported}</div>
          <div className="admin-kpi-cell__label">Offers reported</div>
          <div className="admin-kpi-cell__change">
            {KPIS.offersInternship} internships · {KPIS.offersFullTime} FT
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-section">
            <h2 className="detail-section__title">Where members want to work</h2>
            {INDUSTRY_INTEREST.map((i) => (
              <div className="industry-bar-row" key={i.industry}>
                <span>{i.industry}</span>
                <div className="industry-bar-track">
                  <div className="industry-bar-fill" style={{ width: `${(i.members / maxMembers) * 100}%` }} />
                </div>
                <span className="meta">{i.members}</span>
              </div>
            ))}
            <div className="gap-insight">
              Gap: {gap.members} members target {gap.industry} but UC has only {gap.alumni} alumni there — a
              recruiting-outreach target for this cycle.
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Class-year breakdown</h2>
            <div className="class-year-grid">
              {CLASS_YEAR_BREAKDOWN.map((c) => (
                <div className="class-year-cell" key={c.year}>
                  <div className="class-year-cell__label">{c.label}</div>
                  <div className="class-year-cell__year">Class of {c.year}</div>
                  <p className="meta">{c.members} members</p>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${c.profileCompletePct}%` }} />
                  </div>
                  <p className="meta" style={{ marginBottom: 0 }}>{c.profileCompletePct}% profiles complete</p>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Opportunity queue</h2>
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {opportunityQueue.map((o) => (
                  <tr key={o.id}>
                    <td>{o.company}</td>
                    <td>{o.role}</td>
                    <td>{o.source}</td>
                    <td>
                      <span className="chip chip-accent">
                        {o.status === "Live" ? `Live · ${o.applicants} applicants` : o.status}
                      </span>
                    </td>
                    <td>
                      <div className="queue-table__actions">
                        {o.status === "Needs review" && (
                          <button className="btn btn-secondary" onClick={() => approveOpportunity(o.id)}>
                            Approve
                          </button>
                        )}
                        <button className="btn btn-secondary">Edit</button>
                        <button className="btn btn-secondary" onClick={() => removeOpportunity(o.id)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {opportunityQueue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="meta">
                      Queue is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">Most targeted companies</div>
            {MOST_TARGETED_COMPANIES.map((c) => (
              <div className="company-count-row" key={c.company}>
                <span>{c.company}</span>
                <span>{c.members}</span>
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Member engagement</div>
            <div className="engagement-row">
              <span>Logged in this week</span>
              <span>{MEMBER_ENGAGEMENT.loggedInThisWeek}</span>
            </div>
            <div className="engagement-row">
              <span>Tracking ≥1 application</span>
              <span>{MEMBER_ENGAGEMENT.trackingAtLeastOne}</span>
            </div>
            <div className="engagement-row">
              <span>Booked a coffee chat</span>
              <span>{MEMBER_ENGAGEMENT.bookedCoffeeChat}</span>
            </div>
            <div className="engagement-row">
              <span>Contributed a resource</span>
              <span>{MEMBER_ENGAGEMENT.contributedResource}</span>
            </div>
            <div className="engagement-row is-accent">
              <span>Never opened the platform</span>
              <span>{MEMBER_ENGAGEMENT.neverOpened}</span>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: "var(--space-4)", width: "100%" }}>
              Nudge inactive members
            </button>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Content management</div>
            <Link to="/resources" className="content-mgmt-link">
              <span>Add resource</span>
            </Link>
            <Link to="/companies" className="content-mgmt-link">
              <span>Manage company pages</span>
            </Link>
            <Link to="/feed" className="content-mgmt-link">
              <span>Moderate feed</span>
              <span className="chip chip-accent">{FLAGGED_FEED_POSTS} flagged</span>
            </Link>
            <a href="#" className="content-mgmt-link" onClick={(e) => e.preventDefault()}>
              <span>Post announcement</span>
            </a>
            <Link to="/admin/members" className="content-mgmt-link">
              <span>Manage member access</span>
            </Link>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Access control</div>
            <p className="meta" style={{ marginBottom: "var(--space-2)" }}>{ACCESS_CONTROL.provisioned}</p>
            <p className="meta" style={{ marginBottom: "var(--space-2)" }}>{ACCESS_CONTROL.autoConversion}</p>
            <p className="meta" style={{ marginBottom: 0 }}>{ACCESS_CONTROL.pendingRemovals} pending removals</p>
          </div>
        </div>
      </div>

      {showPostModal && <PostOpportunityModal onClose={() => setShowPostModal(false)} source="Admin posted" />}
    </div>
  );
}
