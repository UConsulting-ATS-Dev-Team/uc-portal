import { useState } from "react";
import Modal from "../Modal.jsx";
import { useAppState } from "../../data/store.jsx";
import "../../styles/onboarding.css";

const TOPICS = ["Career advice", "Referral", "Resume review", "Case prep", "Just getting to know each other"];
const SLOTS = ["Mon 3:00pm", "Tue 4:00pm", "Wed 5:00pm", "Thu 2:00pm", "Fri 1:00pm", "Sat 11:00am"];
const FORMATS = [
  { key: "video", label: "Video · 30 min" },
  { key: "phone", label: "Phone · 20 min" },
  { key: "person", label: "In person · 30 min" },
];
const NOTE_LIMIT = 300;

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("");
}

// person: a mockPeople.js record. onClose: () => void.
export default function RequestCoffeeChatModal({ person, onClose }) {
  const { requestCoffeeChat } = useAppState();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [slots, setSlots] = useState([]);
  const [format, setFormat] = useState("video");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  function toggleSlot(slot) {
    setSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  }

  function handleSend() {
    requestCoffeeChat(person.id);
    setSent(true);
    setTimeout(onClose, 1100);
  }

  return (
    <Modal
      title="Request a coffee chat"
      onClose={onClose}
      footer={
        sent ? (
          <span className="modal__footer-note">Request sent to {person.name}.</span>
        ) : (
          <>
            <span className="modal__footer-note">{person.name} typically replies within 2 days.</span>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={slots.length === 0} onClick={handleSend}>
              Send request
            </button>
          </>
        )
      }
    >
      <div className="modal-context-card">
        <div className="person-card__avatar">{initials(person.name)}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{person.name}</div>
          <div className="meta">
            {person.role}
            {person.company ? ` · ${person.company}` : ""}
          </div>
          {person.openToCoffeeChats && <span className="chip chip-accent">Open to chats</span>}
        </div>
      </div>

      <label className="field-label">What do you want to talk about?</label>
      <div className="chip-row" style={{ marginBottom: "var(--space-5)" }}>
        {TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip-toggle${topic === t ? " is-selected" : ""}`}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="field-label">Times that work for you (select one or more)</label>
      <div className="time-slot-grid">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip-toggle${slots.includes(s) ? " is-selected" : ""}`}
            onClick={() => toggleSlot(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="field-label">Format</label>
      <div className="chip-row" style={{ marginBottom: "var(--space-5)" }}>
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip-toggle${format === f.key ? " is-selected" : ""}`}
            onClick={() => setFormat(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className="field-label">Note (optional)</label>
      <textarea
        rows={3}
        maxLength={NOTE_LIMIT}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`Tell ${person.name.split(" ")[0]} a bit about what you're hoping to learn.`}
      />
      <div className="char-limit">{note.length}/{NOTE_LIMIT}</div>
    </Modal>
  );
}
