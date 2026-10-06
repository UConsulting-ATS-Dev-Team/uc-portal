import { useEffect, useState } from "react";
import { fetchChatsForIntern, fetchInterns } from "../data/acceleratorSync.js";
import { parseYmd } from "../data/acceleratorLogic.js";
import AcceleratorChatPhoto from "./AcceleratorChatPhoto.jsx";
import "../styles/accelerator.css";

// Read-only: an intern's logged coffee chats, with the picture each one submitted.
export default function AdminAcceleratorChats() {
  const [interns, setInterns] = useState(null);
  const [selected, setSelected] = useState("");
  const [chats, setChats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInterns()
      .then(setInterns)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) {
      setChats(null);
      return;
    }
    let cancelled = false;
    setChats(null);
    fetchChatsForIntern(selected)
      .then((rows) => !cancelled && setChats(rows))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className="detail-section">
      <p style={{ fontWeight: 700 }}>Coffee chats</p>
      <p className="meta">What each intern logged: who they met, what they talked about, and the picture. Three a week, at least two with UC members.</p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="chats-intern">Intern</label>
        <select id="chats-intern" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">{interns === null ? "Loading…" : "Choose an intern"}</option>
          {interns?.map((i) => (
            <option key={i.memberId} value={i.memberId}>
              {i.displayName}
            </option>
          ))}
        </select>
      </div>
      {selected && chats === null && <p className="meta">Loading…</p>}
      {chats?.length === 0 && <p className="meta">This intern hasn't logged any coffee chats.</p>}
      {chats?.map((chat) => (
        <div className="accel-chat" key={chat.id}>
          {chat.photo_path ? <AcceleratorChatPhoto path={chat.photo_path} /> : <div className="accel-chat__photo" />}
          <div className="accel-chat__body">
            <div>
              <strong>{chat.contact_name}</strong>{" "}
              <span className={`accel-tag${chat.is_uc_member ? " accel-tag--good" : " accel-tag--optional"}`}>{chat.is_uc_member ? "UC member" : "Not UC"}</span>
            </div>
            <div className="meta">
              {parseYmd(chat.chat_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              {chat.is_uc_member && ` · ${chat.member_year}, ${chat.member_major}`}
            </div>
            <p className="accel-chat__summary">{chat.summary}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
