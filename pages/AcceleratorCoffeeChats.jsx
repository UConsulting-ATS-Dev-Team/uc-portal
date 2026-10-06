import { useMemo, useState } from "react";
import { addCoffeeChat, deleteCoffeeChat, uploadChatPhoto } from "../data/acceleratorSync.js";
import { CHATS_PER_WEEK, UC_CHATS_PER_WEEK, coffeeChatProgress, parseYmd, programWeeks, ymd } from "../data/acceleratorLogic.js";
import { useAcceleratorData } from "../data/useAcceleratorData.js";
import AcceleratorChatPhoto from "../components/AcceleratorChatPhoto.jsx";
import AcceleratorTabs from "../components/AcceleratorTabs.jsx";
import "../styles/jobDetail.css";
import "../styles/accelerator.css";

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Alumni"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const shortDate = (key) => parseYmd(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function ChatForm({ onLogged }) {
  const blank = { chatDate: ymd(new Date()), contactName: "", isUc: true, year: "", major: "", summary: "" };
  const [form, setForm] = useState(blank);
  const [photo, setPhoto] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function validate() {
    if (!form.contactName.trim()) return "Enter the name of the person you met.";
    if (form.isUc && !form.year) return "Choose the UC member's year.";
    if (form.isUc && !form.major.trim()) return "Enter the UC member's major.";
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
    let photoPath = null;
    try {
      photoPath = await uploadChatPhoto(photo);
      await addCoffeeChat({
        chatDate: form.chatDate,
        contactName: form.contactName,
        isUcMember: form.isUc,
        memberYear: form.year,
        memberMajor: form.major,
        summary: form.summary,
        photoPath,
      });
      setForm({ ...blank, chatDate: form.chatDate });
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
      <h2 style={{ marginTop: 0 }}>Log a coffee chat</h2>
      <div className="accel-form__row">
        <div className="field">
          <label htmlFor="chat-date">Date</label>
          <input id="chat-date" type="date" value={form.chatDate} max={ymd(new Date())} onChange={(e) => set({ chatDate: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="chat-name">Who did you meet?</label>
          <input id="chat-name" type="text" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </div>
      </div>
      <div className="checkbox-row" style={{ margin: "var(--space-3) 0" }}>
        <input id="chat-uc" type="checkbox" checked={form.isUc} onChange={() => set({ isUc: !form.isUc })} />
        <label htmlFor="chat-uc">They're a UC member</label>
      </div>
      {form.isUc && (
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
  const { lessons, chats, loading, error, reload } = useAcceleratorData();
  const today = useMemo(() => new Date(), []);
  const weeks = useMemo(() => programWeeks(lessons, chats, today), [lessons, chats, today]);
  const progress = useMemo(() => coffeeChatProgress(chats, weeks, today), [chats, weeks, today]);
  const [deleteError, setDeleteError] = useState(null);

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
      <h1>Coffee chats</h1>
      <p className="meta">
        {CHATS_PER_WEEK} a week, at least {UC_CHATS_PER_WEEK} of them with UC members. {progress.counted} of {progress.target} done.
      </p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <ChatForm onLogged={reload} />

      <div className="accel-section">
        <h2>By week</h2>
        <p className="meta" style={{ marginTop: 0 }}>
          Filled navy: a UC member. Filled blue: someone else. Empty: not logged yet.
        </p>
        <div className="accel-weeks">
          {progress.perWeek.map((week) => {
            const slots = Array.from({ length: CHATS_PER_WEEK }, (_, i) => week.chats[i] ?? null);
            return (
              <div key={week.index} className={`accel-week${week.isCurrent ? " is-current" : ""}`}>
                <span className="accel-week__label">Week {week.number}</span>
                <span className="accel-week__range">
                  {shortDate(week.startKey)} to {shortDate(week.endKey)}
                </span>
                <span className="accel-slots" role="img" aria-label={`${week.total} of ${CHATS_PER_WEEK} chats, ${week.uc} with UC members`}>
                  {slots.map((chat, i) => (
                    <span key={i} className={`accel-slot${chat ? (chat.is_uc_member ? " accel-slot--uc" : " accel-slot--other") : ""}`} />
                  ))}
                </span>
                {week.done && <span className="accel-tag accel-tag--good">Done</span>}
                {week.needsUc && <span className="accel-tag accel-tag--flag">Needs {UC_CHATS_PER_WEEK} UC members</span>}
                {!week.done && !week.needsUc && week.isPast && <span className="accel-tag accel-tag--flag">Short</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="accel-section">
        <h2>Your chats</h2>
        {deleteError && <p className="meta" style={{ color: "var(--color-danger)" }}>{deleteError}</p>}
        {loading && <p className="meta">Loading…</p>}
        {!loading && chats.length === 0 && <p className="meta">No chats logged yet. Add your first above.</p>}
        {chats.map((chat) => (
          <div className="accel-chat" key={chat.id}>
            {chat.photo_path ? <AcceleratorChatPhoto path={chat.photo_path} /> : <div className="accel-chat__photo" />}
            <div className="accel-chat__body">
              <div>
                <strong>{chat.contact_name}</strong>{" "}
                <span className={`accel-tag${chat.is_uc_member ? " accel-tag--good" : " accel-tag--optional"}`}>{chat.is_uc_member ? "UC member" : "Not UC"}</span>
              </div>
              <div className="meta">
                {parseYmd(chat.chat_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {chat.is_uc_member && ` · ${chat.member_year}, ${chat.member_major}`}
              </div>
              <p className="accel-chat__summary">{chat.summary}</p>
              <button type="button" className="btn-link" onClick={() => remove(chat)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
