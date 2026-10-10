import { useMemo, useState } from "react";
import { addCoffeeChat, deleteCoffeeChat, uploadChatPhoto } from "../data/acceleratorSync.js";
import { CHATS_PER_WEEK, coffeeChatProgress, parseYmd, programPeriods, ymd } from "../data/acceleratorLogic.js";
import { useAcceleratorData } from "../data/useAcceleratorData.js";
import AcceleratorChatPhoto from "../components/AcceleratorChatPhoto.jsx";
import AcceleratorTabs from "../components/AcceleratorTabs.jsx";
import "../styles/jobDetail.css";
import "../styles/accelerator.css";

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Alumni"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const dayLabel = (key) => parseYmd(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function SlotCard({ slot }) {
  const chat = slot.chat;
  return (
    <div className={`accel-slotcard${chat ? " is-filled" : ""}`}>
      <div className="accel-slotcard__label">{slot.label}</div>
      {chat ? (
        <>
          <div className="accel-slotcard__name">{chat.contact_name}</div>
          <div className="accel-slotcard__meta">
            {chat.is_uc_member ? "Club member" : "Another intern"} · {dayLabel(chat.chat_date)}
          </div>
        </>
      ) : (
        <div className="accel-slotcard__empty">Not logged yet</div>
      )}
    </div>
  );
}

function ChatForm({ week, onLogged }) {
  const defaultIsClub = week.canLogClub;
  const blank = { chatDate: ymd(new Date()), contactName: "", isClub: defaultIsClub, year: "", major: "", summary: "" };
  const [form, setForm] = useState(blank);
  const [photo, setPhoto] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  // The chosen type may have stopped being allowed since it was picked (its slot just filled).
  const isClub = form.isClub ? week.canLogClub : !week.canLogIntern;

  function validate() {
    if (isClub && !week.canLogClub) return "This week's club member and intern slots are all taken.";
    if (!isClub && !week.canLogIntern) return "Your intern slot this week is taken. Log a chat with a club member instead.";
    if (!form.contactName.trim()) return "Enter the name of the person you met.";
    if (!form.year) return `Choose ${isClub ? "the club member's" : "the intern's"} year.`;
    if (!form.major.trim()) return `Enter ${isClub ? "the club member's" : "the intern's"} major.`;
    if (!form.summary.trim()) return "Say what you talked about.";
    if (!photo) return "Add a picture from the chat.";
    if (photo.size > MAX_PHOTO_BYTES) return "That picture is over 10 MB. Choose a smaller one.";
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const photoPath = await uploadChatPhoto(photo);
      await addCoffeeChat({
        chatDate: form.chatDate,
        contactName: form.contactName,
        isUcMember: isClub,
        memberYear: form.year,
        memberMajor: form.major,
        summary: form.summary,
        photoPath,
      });
      setForm({ ...blank, chatDate: form.chatDate, isClub: true });
      setPhoto(null);
      setFileKey((k) => k + 1);
      await onLogged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="accel-form" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Log a coffee chat for week {week.number}</h3>
      <fieldset className="accel-form__type">
        <legend className="meta">Who did you meet?</legend>
        <label className={!week.canLogClub ? "is-disabled" : ""}>
          <input type="radio" name="chat-type" checked={isClub} disabled={!week.canLogClub} onChange={() => set({ isClub: true })} /> Club member
        </label>
        <label className={!week.canLogIntern ? "is-disabled" : ""}>
          <input type="radio" name="chat-type" checked={!isClub} disabled={!week.canLogIntern} onChange={() => set({ isClub: false })} /> Another intern
        </label>
      </fieldset>
      {!week.canLogIntern && week.canLogClub && <p className="meta">Your intern slot this week is taken, so this one needs to be a club member.</p>}
      <div className="accel-form__row">
        <div className="field">
          <label htmlFor="chat-date">Date</label>
          <input id="chat-date" type="date" value={form.chatDate} max={ymd(new Date())} onChange={(e) => set({ chatDate: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="chat-name">Name</label>
          <input id="chat-name" type="text" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </div>
      </div>
      {(
        <div className="accel-form__row">
          <div className="field">
            <label htmlFor="chat-year">Their year</label>
            <select id="chat-year" value={form.year} onChange={(e) => set({ year: e.target.value })}>
              <option value="">Choose a year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="chat-major">Their major</label>
            <input id="chat-major" type="text" value={form.major} onChange={(e) => set({ major: e.target.value })} />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="chat-summary">What did you talk about? Anything interesting or fun?</label>
        <textarea id="chat-summary" rows={4} value={form.summary} onChange={(e) => set({ summary: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="chat-photo">Picture</label>
        <input key={fileKey} id="chat-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : "Log coffee chat"}
      </button>
    </form>
  );
}

export default function AcceleratorCoffeeChats() {
  const { events, lessons, chats, schedule, loading, error, reload } = useAcceleratorData();
  const now = useMemo(() => new Date(), []);
  const periods = useMemo(() => programPeriods(events, { lessons, chats, today: now, schedule }), [events, lessons, chats, now, schedule]);
  const progress = useMemo(() => coffeeChatProgress(chats, periods, now), [chats, periods, now]);
  const [deleteError, setDeleteError] = useState(null);
  const current = progress.current;

  // Which chats fill a slot (and so count) versus extras that don't, and which week each belongs to.
  const chatInfo = useMemo(() => {
    const info = new Map();
    for (const week of progress.perWeek) {
      const countedIds = new Set(week.slots.filter((s) => s.chat).map((s) => s.chat.id));
      for (const chat of week.chats) info.set(chat.id, { week, counts: countedIds.has(chat.id) });
    }
    return info;
  }, [progress]);

  async function remove(chat) {
    if (!window.confirm(`Delete your coffee chat with ${chat.contact_name}?`)) return;
    setDeleteError(null);
    try {
      await deleteCoffeeChat(chat);
      await reload();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  return (
    <div>
      <AcceleratorTabs />
      <h1 className="accel-title">Coffee Chats</h1>
      {current && (
        <p className="meta">
          This week: {current.counted} of {CHATS_PER_WEEK}
        </p>
      )}
      {!periods[0]?.byMeeting && (
        <p className="meta">The accelerator's weekly day and time haven't been set yet, so weeks run Sunday to Saturday for now.</p>
      )}
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      {current ? (
        <div className="accel-section">
          <h2>
            This week <span className="meta">Week {current.number}, due {current.dueLabel}</span>
          </h2>
          <div className="accel-slotcards">
            {current.slots.map((slot, i) => (
              <SlotCard key={i} slot={slot} />
            ))}
          </div>
          {current.done ? (
            <p className="meta" style={{ marginTop: "var(--space-4)" }}>
              All three are logged. Next week opens right after the accelerator meeting, so a chat logged before then counts toward this week and one logged after counts toward the next.
            </p>
          ) : (
            <div style={{ marginTop: "var(--space-5)" }}>
              <ChatForm key={`${current.number}-${current.counted}`} week={current} onLogged={reload} />
            </div>
          )}
        </div>
      ) : (
        !loading && (
          <p className="meta">The last accelerator meeting has passed, so there are no more weeks to log chats for.</p>
        )
      )}

      <div className="accel-section">
        <h2>All weeks</h2>
        <div className="accel-weeks">
          {progress.perWeek.map((week) => (
            <div key={week.index} className={`accel-week accel-week--stack${week.isCurrent ? " is-current" : ""}`}>
              <div className="accel-week__head">
                <span className="accel-week__label">Week {week.number}</span>
                <span className="accel-week__range">
                  {week.isPast ? "Closed" : "Due"} {week.dueLabel}
                  {week.projected && " (projected)"}
                </span>
                {week.done && <span className="accel-tag accel-tag--good">Done</span>}
                {!week.done && week.isPast && <span className="accel-tag accel-tag--flag">Short</span>}
                {week.isCurrent && !week.done && <span className="accel-tag accel-tag--accelerator">This week</span>}
              </div>
              {(week.isPast || week.isCurrent) && (
                <div className="accel-pills">
                  {week.slots.map((slot, i) => (
                    <span key={i} className={`accel-pill${slot.chat ? " is-filled" : ""}`}>
                      <span className="accel-pill__label">{slot.label}</span>
                      {slot.chat ? slot.chat.contact_name : "Open"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="accel-section">
        <h2>Your chats</h2>
        {deleteError && <p className="meta" style={{ color: "var(--color-danger)" }}>{deleteError}</p>}
        {loading && <p className="meta">Loading…</p>}
        {!loading && chats.length === 0 && <p className="meta">No chats logged yet. Add your first above.</p>}
        {chats.map((chat) => {
          const info = chatInfo.get(chat.id);
          return (
            <div className="accel-chat" key={chat.id}>
              {chat.photo_path ? <AcceleratorChatPhoto path={chat.photo_path} /> : <div className="accel-chat__photo" />}
              <div className="accel-chat__body">
                <div>
                  <strong>{chat.contact_name}</strong>{" "}
                  <span className={`accel-tag${chat.is_uc_member ? " accel-tag--good" : " accel-tag--optional"}`}>{chat.is_uc_member ? "Club member" : "Another intern"}</span>{" "}
                  {info && (info.counts ? <span className="accel-tag">Week {info.week.number}</span> : <span className="accel-tag accel-tag--flag">Doesn't count, slot taken</span>)}
                </div>
                <div className="meta">
                  {parseYmd(chat.chat_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  {chat.member_year && ` · ${chat.member_year}, ${chat.member_major}`}
                </div>
                <p className="accel-chat__summary">{chat.summary}</p>
                {info?.week.isCurrent && (
                  <button type="button" className="btn-link" onClick={() => remove(chat)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
