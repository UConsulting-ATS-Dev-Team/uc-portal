import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { EMPTY_AUDIENCE, describeAudience, resolveAudience } from "../../supabase/functions/_shared/comms/audience.ts";
import { fillMergeFields, mergeVarsFor, unknownMergeFields } from "../../supabase/functions/_shared/comms/render.ts";
import { deleteSavedAudience, logImessage, saveAudience } from "../../data/commsSync.js";
import AudienceBuilder from "./AudienceBuilder.jsx";
import MessageEditor from "./MessageEditor.jsx";
import "../../styles/comms.css";

// iMessage the ATS way: the portal can't text anyone itself. It writes each person's message, opens it in the admin's own Messages
// app (a phone or Mac), and afterwards records which ones the admin actually sent. Works today, with no provider to connect.
// "Text me a test" opens the same message addressed to the admin's own number.
export function smsHref(phone, text) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `sms:${digits}?&body=${encodeURIComponent(text)}`;
}

export default function ImessageTab({ people, suppressedEmails, savedAudiences, onAudiencesChanged, ownPhone }) {
  const [audience, setAudience] = useState(() => JSON.parse(JSON.stringify(EMPTY_AUDIENCE)));
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(() => new Set());
  const [testPhone, setTestPhone] = useState(ownPhone ?? "");
  const [notice, setNotice] = useState(null);
  const [logging, setLogging] = useState(false);

  const resolved = useMemo(() => resolveAudience(people, audience, { channel: "imessage", suppressedEmails }), [people, audience, suppressedEmails]);
  const unknown = unknownMergeFields(body);
  const textFor = (person) => fillMergeFields(body, mergeVarsFor(person));

  function open(person) {
    window.location.href = smsHref(person.phone, textFor(person));
    setSent((prev) => new Set(prev).add(person.key));
  }

  async function logSent() {
    const chosen = resolved.recipients.filter((p) => sent.has(p.key));
    if (chosen.length === 0) return;
    setLogging(true);
    try {
      await logImessage({ body, audienceLabel: describeAudience(audience), audience, recipients: chosen });
      setNotice({ kind: "ok", text: `Logged ${chosen.length} message${chosen.length === 1 ? "" : "s"} as sent. They're in the Logs tab.` });
      setSent(new Set());
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    }
    setLogging(false);
  }

  return (
    <div className="composer-panel">
      <p className="meta" style={{ marginTop: 0 }}>
        Each message opens in your own Messages app, addressed to one person, with their name filled in. You press send there. Only people with a
        phone number on their profile can be reached this way.
      </p>
      <AudienceBuilder
        audience={audience}
        onChange={setAudience}
        people={people}
        suppressedEmails={suppressedEmails}
        channel="imessage"
        savedAudiences={savedAudiences}
        onSaveAudience={async (name) => {
          await saveAudience(name, audience);
          onAudiencesChanged();
        }}
        onDeleteSaved={async (s) => {
          if (!window.confirm(`Delete the saved audience "${s.name}"?`)) return;
          await deleteSavedAudience(s.id);
          onAudiencesChanged();
        }}
      />

      <MessageEditor value={body} onChange={setBody} channel="imessage" label="Message" />
      {unknown.length > 0 && <p className="comms-notice" style={{ color: "var(--color-danger)" }}>{`{{${unknown[0]}}} isn't a field we can fill in.`}</p>}

      <div className="imessage-test">
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="im-test">Your number</label>
          <input id="im-test" type="text" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(310) 555-1234" />
        </div>
        <a
          className={`btn btn-secondary${!body.trim() || !testPhone.trim() ? " is-disabled" : ""}`}
          href={body.trim() && testPhone.trim() ? smsHref(testPhone, fillMergeFields(body, mergeVarsFor({ name: "Pat Example", email: "pat@example.com" }))) : undefined}
          aria-disabled={!body.trim() || !testPhone.trim()}
        >
          <MessageSquare size={14} strokeWidth={1.5} aria-hidden="true" /> Text me a test
        </a>
      </div>

      {notice && <p className="comms-notice" style={{ color: notice.kind === "error" ? "var(--color-danger)" : "var(--color-text)" }}>{notice.text}</p>}

      <h3 style={{ margin: "var(--space-6) 0 var(--space-3)" }}>
        Recipients <span className="meta">{resolved.recipients.length} with a phone number{resolved.excluded.length > 0 ? `, ${resolved.excluded.length} left out` : ""}</span>
      </h3>
      {resolved.recipients.length === 0 && <p className="meta">Nobody in this audience has a phone number on file yet. Members add theirs on their profile.</p>}
      <ul className="recipient-list recipient-list--actions">
        {resolved.recipients.slice(0, 300).map((p) => (
          <li key={p.key}>
            <span>
              {p.name} <span className="meta">{p.phone}</span>
            </span>
            <span className="recipient-list__buttons">
              {sent.has(p.key) && <span className="accel-tag accel-tag--good">Opened</span>}
              <button type="button" className="btn btn-secondary" disabled={!body.trim() || unknown.length > 0} onClick={() => open(p)}>
                Open in Messages
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="composer-panel__actions">
        <button type="button" className="btn btn-primary" disabled={sent.size === 0 || logging} onClick={logSent}>
          {logging ? "Logging…" : `Log ${sent.size} as sent`}
        </button>
        <span className="meta">The portal can't see what you send from your phone, so tell it which ones went out.</span>
      </div>
    </div>
  );
}
