import { useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, List } from "lucide-react";
import { MERGE_FIELDS, composeEmailHtml, fillMergeFields, fillMergeFieldsHtml, markdownToHtml, mergeVarsFor } from "../../supabase/functions/_shared/comms/render.ts";
import "../../styles/comms.css";

// The body box for email, Slack and iMessage: a small Markdown dialect with a formatting toolbar, merge-field chips that insert
// {{firstName}} and friends at the cursor, and a preview that shows what one recipient will actually get.
export default function MessageEditor({ value, onChange, channel, subject, previewPerson, label = "Message", fields = MERGE_FIELDS, sampleVars = {} }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);

  function wrap(before, after = before, placeholder = "text") {
    const el = ref.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function bullet() {
    const el = ref.current;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    onChange(`${value.slice(0, lineStart)}- ${value.slice(lineStart)}`);
    requestAnimationFrame(() => el.focus());
  }

  function insertLink() {
    const el = ref.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "link text";
    onChange(`${value.slice(0, start)}[${selected}](https://)${value.slice(end)}`);
    requestAnimationFrame(() => el.focus());
  }

  function insertField(name) {
    const el = ref.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    onChange(`${value.slice(0, start)}{{${name}}}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      const at = start + name.length + 4;
      el.setSelectionRange(at, at);
    });
  }

  const vars = { ...mergeVarsFor(previewPerson ?? { name: "Pat Example", email: "pat@example.com" }), ...sampleVars };
  const emailHtml = composeEmailHtml({ bodyHtml: fillMergeFieldsHtml(markdownToHtml(value || ""), vars), unsubscribeUrl: channel === "email" ? "#" : null });

  return (
    <div className="msg-editor">
      <div className="msg-editor__head">
        <label htmlFor="msg-body">{label} (Markdown supported)</label>
        <div className="msg-editor__mode">
          <button type="button" className={`btn-link${!preview ? " is-active" : ""}`} onClick={() => setPreview(false)}>
            Write
          </button>
          <button type="button" className={`btn-link${preview ? " is-active" : ""}`} onClick={() => setPreview(true)}>
            Preview
          </button>
        </div>
      </div>

      {preview ? (
        <div className="msg-editor__preview">
          {channel === "email" && <p className="meta msg-editor__subject">Subject: {fillMergeFields(subject || "", vars) || "(none yet)"}</p>}
          {channel === "email" ? (
            <iframe title="Email preview" sandbox="" srcDoc={emailHtml} />
          ) : (
            <pre>{fillMergeFields(value || "", vars)}</pre>
          )}
          <p className="meta">Shown with sample details ({vars.fullName}). Each recipient's own name and email fill the fields.</p>
        </div>
      ) : (
        <>
          <textarea id="msg-body" ref={ref} rows={10} value={value} onChange={(e) => onChange(e.target.value)} />
          <div className="msg-editor__tools">
            <button type="button" className="btn btn-secondary" aria-label="Bold" onClick={() => wrap("**")}>
              <Bold size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-secondary" aria-label="Italic" onClick={() => wrap("*")}>
              <Italic size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-secondary" aria-label="Bulleted list" onClick={bullet}>
              <List size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-secondary" aria-label="Link" onClick={insertLink}>
              <LinkIcon size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <span className="meta">Use **bold**, *italic*, - lists and [links](url). Line breaks are kept.</span>
          </div>
          <div className="msg-editor__fields">
            <span className="meta">Click a field to insert it into the message:</span>
            {fields.map((name) => (
              <button type="button" className="chip" key={name} onClick={() => insertField(name)}>
                {`{{${name}}}`}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
