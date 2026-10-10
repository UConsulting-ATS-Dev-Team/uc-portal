import { useEffect, useMemo, useState } from "react";
import { Eye, Save, Send, CalendarClock } from "lucide-react";
import { EMPTY_AUDIENCE, EXCLUDE_LABEL, describeAudience, resolveAudience } from "../../supabase/functions/_shared/comms/audience.ts";
import { unknownMergeFields } from "../../supabase/functions/_shared/comms/render.ts";
import { deleteSavedAudience, saveAudience, saveDraft, sendCommunication } from "../../data/commsSync.js";
import AudienceBuilder from "./AudienceBuilder.jsx";
import MessageEditor from "./MessageEditor.jsx";
import SenderPicker from "./SenderPicker.jsx";
import Modal from "../Modal.jsx";
import "../../styles/comms.css";

const blank = () => ({ id: null, subject: "", body: "", audience: JSON.parse(JSON.stringify(EMPTY_AUDIENCE)), slackTarget: "", slackMode: "dm", scheduledFor: "", draftName: "", templateId: "", senderPresetId: "" });

function fromInitial(initial) {
  if (!initial) return blank();
  return {
    ...blank(),
    id: initial.id ?? null,
    subject: initial.subject ?? "",
    body: initial.body ?? "",
    audience: initial.audience ?? blank().audience,
    slackTarget: initial.slack_target ?? "",
    slackMode: initial.slack_target ? "channel" : "dm",
    scheduledFor: initial.scheduled_for ? new Date(initial.scheduled_for).toISOString().slice(0, 16) : "",
    draftName: initial.name ?? "",
    templateId: initial.templateId ?? "",
  };
}

// Email and Slack share one composer: pick who, write the message, then preview, test, send now, or schedule. Sending is always
// the last step behind a confirmation that states the exact number of recipients, and the server re-checks that number.
export default function Composer({ channel, people, suppressedEmails, status, ownEmail, savedAudiences, onAudiencesChanged, templates, initial, onQueued, onDraftSaved }) {
  const [state, setState] = useState(() => fromInitial(initial));
  const [modal, setModal] = useState(null); // null | "recipients" | "send" | "schedule"
  const [recipientsView, setRecipientsView] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null); // { kind: "ok" | "error", text }
  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  // A draft or template opened from another tab replaces what is here.
  useEffect(() => {
    setState(fromInitial(initial));
    setNotice(null);
  }, [initial]);

  const isEmail = channel === "email";
  const connected = isEmail ? Boolean(status?.email?.configured && status?.unsubscribeSecretSet) : Boolean(status?.slack?.configured);
  const channelPost = channel === "slack" && state.slackMode === "channel";
  const resolved = useMemo(() => resolveAudience(people, state.audience, { channel, suppressedEmails }), [people, state.audience, channel, suppressedEmails]);
  const recipientCount = channelPost ? 1 : resolved.recipients.length;
  const unknown = unknownMergeFields(`${state.subject}\n${state.body}`);
  const ready = state.body.trim() && (!isEmail || state.subject.trim()) && unknown.length === 0 && recipientCount > 0 && (!channelPost || state.slackTarget);
  const blockedReason = !connected
    ? isEmail
      ? "Email isn't connected yet."
      : "Slack isn't connected yet."
    : !state.body.trim()
      ? "Write a message first."
      : isEmail && !state.subject.trim()
        ? "Add a subject."
        : unknown.length
          ? `{{${unknown[0]}}} isn't a field we can fill in.`
          : channelPost && !state.slackTarget
            ? "Choose a Slack channel."
            : recipientCount === 0
              ? "Nobody would receive this."
              : null;

  const payload = () => ({
    channel,
    subject: state.subject,
    body: state.body,
    audience: state.audience,
    slackTarget: channelPost ? state.slackTarget : null,
    templateId: state.templateId || null,
    senderPresetId: isEmail ? state.senderPresetId || null : null,
  });

  async function run(action, extra = {}) {
    setBusy(action);
    setNotice(null);
    try {
      const result = await sendCommunication({ action, ...payload(), ...extra });
      return result;
    } catch (err) {
      if (err.code === "audience_changed") {
        setNotice({ kind: "error", text: `The audience changed while you were reviewing (now ${err.details.recipientCount} people). Check the count and send again.` });
      } else if (err.code === "email_not_configured" || err.code === "slack_not_configured") {
        setNotice({ kind: "error", text: isEmail ? "Email isn't connected yet." : "Slack isn't connected yet." });
      } else if (err.code === "unsubscribe_secret_missing") {
        setNotice({ kind: "error", text: "Email can't go out until the unsubscribe link is set up." });
      } else {
        setNotice({ kind: "error", text: err.message });
      }
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    const result = await run("test");
    if (result) setNotice({ kind: "ok", text: result.failed ? "The test didn't go through. See the Logs tab for the reason." : `Test sent to ${ownEmail}.` });
  }

  async function confirmSend() {
    const result = await run("send", { confirmCount: recipientCount });
    if (result) {
      setModal(null);
      setNotice({ kind: "ok", text: `Sending to ${result.recipientCount} ${result.recipientCount === 1 ? "person" : "people"}. Progress is in the Logs tab.` });
      onQueued?.();
    }
  }

  async function confirmSchedule() {
    const when = new Date(state.scheduledFor);
    if (!state.scheduledFor || Number.isNaN(when.getTime())) {
      setNotice({ kind: "error", text: "Pick a date and time first." });
      setModal(null);
      return;
    }
    const result = await run("schedule", { confirmCount: recipientCount, scheduledFor: when.toISOString() });
    if (result) {
      setModal(null);
      setNotice({ kind: "ok", text: `Scheduled for ${when.toLocaleString()} to ${result.recipientCount} ${result.recipientCount === 1 ? "person" : "people"}.` });
      onQueued?.();
    }
  }

  async function saveCurrentDraft() {
    if (!state.draftName.trim()) {
      setNotice({ kind: "error", text: "Name the draft first." });
      return;
    }
    try {
      const id = await saveDraft({ id: state.id, name: state.draftName, channel, subject: state.subject, body: state.body, audience: state.audience, slackTarget: channelPost ? state.slackTarget : null, scheduledFor: state.scheduledFor ? new Date(state.scheduledFor).toISOString() : null });
      set({ id });
      setNotice({ kind: "ok", text: "Draft saved." });
      onDraftSaved?.();
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    }
  }

  function applyTemplate(id) {
    const t = templates.find((x) => x.id === id);
    if (!t) return set({ templateId: "" });
    set({ templateId: id, subject: t.subject ?? state.subject, body: t.body });
  }

  const typeTemplates = templates.filter((t) => t.channel === channel);

  return (
    <div className="composer-panel">
      <AudienceBuilder
        audience={state.audience}
        onChange={(audience) => set({ audience })}
        people={people}
        suppressedEmails={suppressedEmails}
        channel={channel}
        savedAudiences={savedAudiences}
        onSaveAudience={async (name) => {
          await saveAudience(name, state.audience);
          onAudiencesChanged();
        }}
        onDeleteSaved={async (s) => {
          if (!window.confirm(`Delete the saved audience "${s.name}"?`)) return;
          await deleteSavedAudience(s.id);
          onAudiencesChanged();
        }}
        onPreview={(r) => {
          setRecipientsView(r);
          setModal("recipients");
        }}
      />

      {channel === "slack" && (
        <div className="slack-target">
          <label>
            <input type="radio" name="slack-mode" checked={state.slackMode === "dm"} onChange={() => set({ slackMode: "dm" })} /> Direct message each person in the audience
          </label>
          <label>
            <input type="radio" name="slack-mode" checked={state.slackMode === "channel"} onChange={() => set({ slackMode: "channel" })} /> Post once to a channel
          </label>
          {channelPost && (
            <div className="field" style={{ marginTop: "var(--space-3)" }}>
              <label htmlFor="slack-channel">Channel</label>
              {status?.slackChannels?.length ? (
                <select id="slack-channel" value={state.slackTarget} onChange={(e) => set({ slackTarget: e.target.value })}>
                  <option value="">Choose a channel</option>
                  {status.slackChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input id="slack-channel" type="text" value={state.slackTarget} onChange={(e) => set({ slackTarget: e.target.value })} placeholder="Channel ID, for example C0123456789" />
              )}
            </div>
          )}
        </div>
      )}

      {typeTemplates.length > 0 && (
        <div className="field">
          <label htmlFor="comp-template">Use template</label>
          <select id="comp-template" value={state.templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">No template</option>
            {typeTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isEmail && <SenderPicker value={state.senderPresetId} onChange={(senderPresetId) => set({ senderPresetId })} fromEmail={status?.email?.fromEmail} />}

      {isEmail && (
        <div className="field">
          <label htmlFor="comp-subject">Subject</label>
          <input id="comp-subject" type="text" value={state.subject} onChange={(e) => set({ subject: e.target.value })} />
        </div>
      )}

      <MessageEditor value={state.body} onChange={(body) => set({ body })} channel={channel} subject={state.subject} />

      <div className="field" style={{ maxWidth: 280, marginTop: "var(--space-5)" }}>
        <label htmlFor="comp-schedule">Schedule for later (optional)</label>
        <input id="comp-schedule" type="datetime-local" value={state.scheduledFor} onChange={(e) => set({ scheduledFor: e.target.value })} />
      </div>

      {notice && (
        <p className="comms-notice" style={{ color: notice.kind === "error" ? "var(--color-danger)" : "var(--color-text)" }} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <div className="composer-panel__draft">
        <input type="text" aria-label="Draft name" placeholder="Draft name" value={state.draftName} onChange={(e) => set({ draftName: e.target.value })} />
        <button type="button" className="btn btn-secondary" onClick={saveCurrentDraft}>
          <Save size={14} strokeWidth={1.5} aria-hidden="true" /> Save draft
        </button>
      </div>

      <div className="composer-panel__actions">
        <button type="button" className="btn btn-secondary" disabled={recipientCount === 0} onClick={() => { setRecipientsView(resolved); setModal("recipients"); }}>
          <Eye size={14} strokeWidth={1.5} aria-hidden="true" /> Preview recipients
        </button>
        <button type="button" className="btn btn-secondary" disabled={!connected || !state.body.trim() || (isEmail && !state.subject.trim()) || busy} title={!connected ? blockedReason : undefined} onClick={sendTest}>
          <Send size={14} strokeWidth={1.5} aria-hidden="true" /> {busy === "test" ? "Sending test…" : `Send test to ${ownEmail ?? "me"}`}
        </button>
        <button type="button" className="btn btn-primary" disabled={!connected || !ready || busy} title={blockedReason ?? undefined} onClick={() => setModal("send")}>
          <Send size={14} strokeWidth={1.5} aria-hidden="true" /> Send {isEmail ? "email" : "to Slack"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={!connected || !ready || !state.scheduledFor || busy} title={!state.scheduledFor ? "Pick a time above first." : blockedReason ?? undefined} onClick={() => setModal("schedule")}>
          <CalendarClock size={14} strokeWidth={1.5} aria-hidden="true" /> Schedule
        </button>
      </div>
      {!connected && (
        <p className="meta">
          {isEmail ? "Sending, scheduling and test emails switch on once the email account is connected." : "Sending to Slack switches on once Slack is connected."} Everything else here already works.
        </p>
      )}

      {modal === "recipients" && recipientsView && (
        <Modal title={`${recipientsView.recipients.length} recipient${recipientsView.recipients.length === 1 ? "" : "s"}`} onClose={() => setModal(null)} width={640} footer={<button className="btn btn-secondary" onClick={() => setModal(null)}>Close</button>}>
          <p className="meta" style={{ marginTop: 0 }}>{describeAudience(state.audience)}</p>
          <ul className="recipient-list">
            {recipientsView.recipients.slice(0, 300).map((p) => (
              <li key={p.key}>
                <span>{p.name}</span>
                <span className="meta">{channel === "imessage" ? p.phone : p.email}</span>
              </li>
            ))}
          </ul>
          {recipientsView.recipients.length > 300 && <p className="meta">Showing the first 300.</p>}
          {recipientsView.excluded.length > 0 && (
            <>
              <h3 style={{ margin: "var(--space-5) 0 var(--space-2)" }}>Left out ({recipientsView.excluded.length})</h3>
              <ul className="recipient-list">
                {recipientsView.excluded.slice(0, 100).map((e) => (
                  <li key={e.person.key}>
                    <span>{e.person.name}</span>
                    <span className="meta">{EXCLUDE_LABEL[e.reason]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}

      {(modal === "send" || modal === "schedule") && (
        <Modal
          title={modal === "send" ? "Send this message?" : "Schedule this message?"}
          onClose={() => !busy && setModal(null)}
          width={520}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={Boolean(busy)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={modal === "send" ? confirmSend : confirmSchedule} disabled={Boolean(busy)}>
                {busy ? "Working…" : modal === "send" ? `Send to ${recipientCount} ${recipientCount === 1 ? "person" : "people"}` : `Schedule for ${recipientCount}`}
              </button>
            </>
          }
        >
          <dl className="confirm-facts">
            <div>
              <dt>To</dt>
              <dd>
                {channelPost ? `Slack channel ${state.slackTarget}` : `${recipientCount} ${recipientCount === 1 ? "person" : "people"}`}
                <span className="meta">{channelPost ? "" : ` · ${describeAudience(state.audience)}`}</span>
              </dd>
            </div>
            {isEmail && (
              <div>
                <dt>Subject</dt>
                <dd>{state.subject}</dd>
              </div>
            )}
            {modal === "schedule" && (
              <div>
                <dt>When</dt>
                <dd>{new Date(state.scheduledFor).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          <p className="meta" style={{ marginBottom: 0 }}>
            {modal === "send" ? "This goes out right away and can't be recalled." : "You can cancel it any time before then from the Scheduled tab."}
          </p>
        </Modal>
      )}
    </div>
  );
}
