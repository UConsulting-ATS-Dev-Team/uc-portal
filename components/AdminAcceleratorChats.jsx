import { Fragment, useEffect, useMemo, useState } from "react";
import { adminSetChatWeek, fetchAllCoffeeChats, fetchEvents, fetchInterns, fetchLessons, fetchMeetingSchedule } from "../data/acceleratorSync.js";
import { CHAT_SLOT_LABELS, CHATS_PER_WEEK, coffeeChatProgress, coffeeChatSlots, parseYmd, programPeriods } from "../data/acceleratorLogic.js";
import AcceleratorChatPhoto from "./AcceleratorChatPhoto.jsx";
import CollapsibleSection from "./CollapsibleSection.jsx";
import "../styles/accelerator.css";

// Every intern's coffee chats at a glance (the only change an admin can make here is which week a chat counts toward). One row per intern, with this week's three slots side by side; open a
// row for everything that intern has logged, with the picture and what they talked about.
export default function AdminAcceleratorChats() {
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    return Promise.all([fetchInterns(), fetchAllCoffeeChats(), fetchEvents(), fetchLessons(), fetchMeetingSchedule()])
      .then(([interns, chats, events, lessons, schedule]) => setData({ interns, chats, events, lessons, schedule }))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  // A chat counts toward the week it was logged in. When one really belongs to an earlier week (done then, logged late), this
  // counts it toward that week by moving its logged time inside it. Refused when that week already has all three slots filled.
  async function moveChat(row, chat, weekNumber) {
    const target = row.perWeek.find((w) => w.number === weekNumber);
    if (!target) return;
    const others = target.chats.filter((c) => c.id !== chat.id);
    if (coffeeChatSlots([...others, chat]).counted <= coffeeChatSlots(others).counted) {
      setError(`Week ${weekNumber} already has all of ${row.intern.displayName}'s chat slots filled, so this chat wouldn't count there.`);
      return;
    }
    if (!window.confirm(`Count this chat toward week ${weekNumber} for ${row.intern.displayName}?`)) return;
    setError(null);
    setBusyId(chat.id);
    try {
      // Just inside the end of that week (or now, for the current week).
      const when = new Date(Math.min(target.endMs - 60000, Date.now()));
      await adminSetChatWeek(chat.id, when, weekNumber);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  }

  const rows = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    return data.interns.map((intern) => {
      const own = data.chats.filter((c) => c.profile_id === intern.memberId).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const periods = programPeriods(data.events, { lessons: data.lessons, chats: own, today: now, schedule: data.schedule });
      const progress = coffeeChatProgress(own, periods, now);
      const week = progress.current ?? progress.perWeek[progress.perWeek.length - 1];
      const weekOf = new Map();
      for (const w of progress.perWeek) for (const c of w.chats) weekOf.set(c.id, w.number);
      // Weeks that have started (not the projected future ones), for the "count toward" menu.
      const choices = progress.perWeek.filter((w) => w.startMs < now.getTime());
      return { intern, own, week, behind: progress.behind.length, perWeek: progress.perWeek, weekOf, choices };
    });
  }, [data]);

  return (
    <CollapsibleSection
      title="Coffee Chats"
      summary={
        rows === null
          ? "Loading…"
          : `${rows.length} intern${rows.length === 1 ? "" : "s"}, ${rows.reduce((n, r) => n + (r.week ? r.week.counted : 0), 0)} of ${rows.length * CHATS_PER_WEEK} chats logged this week`
      }
    >
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
              {rows.map((row) => {
                const { intern, own, week, behind } = row;
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
                                {chat.photo_path ? <AcceleratorChatPhoto path={chat.photo_path} /> : <div className="accel-chat__photo" />}
                                <div style={{ marginTop: "var(--space-2)" }}>{chat.contact_name}</div>
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
                                <div className="meta">
                                  <label>
                                    Counts toward{" "}
                                    <select
                                      aria-label={`Week this chat counts toward for ${intern.displayName}`}
                                      value={row.weekOf.get(chat.id) ?? ""}
                                      disabled={busyId === chat.id}
                                      onChange={(e) => moveChat(row, chat, Number(e.target.value))}
                                    >
                                      {!row.weekOf.has(chat.id) && <option value="">No week</option>}
                                      {row.choices.map((w) => (
                                        <option key={w.number} value={w.number}>
                                          Week {w.number}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
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
    </CollapsibleSection>
  );
}
