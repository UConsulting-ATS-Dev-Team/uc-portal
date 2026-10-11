import { Fragment, useEffect, useMemo, useState } from "react";
import { fetchAllCoffeeChats, fetchEvents, fetchInterns, fetchLessons, fetchMeetingSchedule } from "../data/acceleratorSync.js";
import { CHAT_SLOT_LABELS, CHATS_PER_WEEK, coffeeChatProgress, parseYmd, programPeriods } from "../data/acceleratorLogic.js";
import AcceleratorChatPhoto from "./AcceleratorChatPhoto.jsx";
import "../styles/accelerator.css";

// Read-only: every intern's coffee chats at a glance. One row per intern, with this week's three slots side by side; open a
// row for everything that intern has logged, with the picture and what they talked about.
export default function AdminAcceleratorChats() {
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchInterns(), fetchAllCoffeeChats(), fetchEvents(), fetchLessons(), fetchMeetingSchedule()])
      .then(([interns, chats, events, lessons, schedule]) => setData({ interns, chats, events, lessons, schedule }))
      .catch((e) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    return data.interns.map((intern) => {
      const own = data.chats.filter((c) => c.profile_id === intern.memberId).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const periods = programPeriods(data.events, { lessons: data.lessons, chats: own, today: now, schedule: data.schedule });
      const progress = coffeeChatProgress(own, periods, now);
      const week = progress.current ?? progress.perWeek[progress.perWeek.length - 1];
      return { intern, own, week, behind: progress.behind.length };
    });
  }, [data]);

  return (
    <div className="detail-section">
      <p style={{ fontWeight: 700 }}>Coffee Chats</p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <p className="meta">No intern accounts yet.</p>}
      {rows?.length > 0 && (
        <div className="queue-table__scroll">
          <table className="queue-table accel-chat-table">
            <thead>
              <tr>
                <th>Intern</th>
                <th>This week</th>
                {CHAT_SLOT_LABELS.map((label, i) => (
                  <th key={i}>{label}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ intern, own, week, behind }) => {
                const open = openId === intern.memberId;
                return (
                  <Fragment key={intern.memberId}>
                    <tr>
                      <td>
                        <strong>{intern.displayName}</strong>
                        {behind > 0 && (
                          <div className="meta" style={{ color: "var(--color-danger)" }}>
                            {behind} week{behind === 1 ? "" : "s"} short
                          </div>
                        )}
                      </td>
                      <td>
                        {week ? week.counted : 0} / {CHATS_PER_WEEK}
                      </td>
                      {CHAT_SLOT_LABELS.map((_, i) => {
                        const chat = week?.slots?.[i]?.chat;
                        return (
                          <td key={i} className={chat ? "" : "meta"}>
                            {chat ? (
                              <>
                                <div>{chat.contact_name}</div>
                                <div className="meta">
                                  {chat.is_uc_member ? "UC member" : "Intern"}
                                  {chat.member_year && ` · ${chat.member_year}, ${chat.member_major}`}
                                </div>
                              </>
                            ) : (
                              "Not logged yet"
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <button type="button" className="btn-link" onClick={() => setOpenId(open ? null : intern.memberId)} aria-expanded={open}>
                          {open ? "Hide" : `All chats (${own.length})`}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={2 + CHAT_SLOT_LABELS.length + 1} style={{ background: "var(--color-ground)" }}>
                          {own.length === 0 && <p className="meta">This intern hasn't logged any coffee chats.</p>}
                          {own.map((chat) => (
                            <div className="accel-chat" key={chat.id}>
                              {chat.photo_path ? <AcceleratorChatPhoto path={chat.photo_path} /> : <div className="accel-chat__photo" />}
                              <div className="accel-chat__body">
                                <div>
                                  <strong>{chat.contact_name}</strong>{" "}
                                  <span className={`accel-tag${chat.is_uc_member ? " accel-tag--good" : " accel-tag--optional"}`}>
                                    {chat.is_uc_member ? "UC member" : "Intern"}
                                  </span>
                                </div>
                                <div className="meta">
                                  {parseYmd(chat.chat_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                  {chat.member_year && ` · ${chat.member_year}, ${chat.member_major}`}
                                </div>
                                <p className="accel-chat__summary">{chat.summary}</p>
                              </div>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
