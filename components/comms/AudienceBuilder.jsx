import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { AUDIENCE_PRESETS, EMPTY_AUDIENCE, EXCLUDE_LABEL, FIELD_DEFS, OP_LABEL, resolveAudience } from "../../supabase/functions/_shared/comms/audience.ts";
import "../../styles/comms.css";

const fieldDef = (key) => FIELD_DEFS.find((f) => f.key === key);

function defaultValue(def) {
  if (def.type === "enum") return def.options[0].value;
  if (def.type === "boolean") return true;
  if (def.type === "number") return 2027;
  return "";
}

function ValueInput({ def, condition, onChange }) {
  if (def.type === "enum") {
    return (
      <select aria-label="Value" value={String(condition.value)} onChange={(e) => onChange(e.target.value)}>
        {def.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (def.type === "boolean") {
    return (
      <select aria-label="Value" value={condition.value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "yes")}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (def.type === "date") return <input aria-label="Value" type="date" value={String(condition.value)} onChange={(e) => onChange(e.target.value)} />;
  if (def.type === "number") return <input aria-label="Value" type="number" value={condition.value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
  return <input aria-label="Value" type="text" value={String(condition.value)} placeholder="Tag" onChange={(e) => onChange(e.target.value)} />;
}

// Builds the "who gets this" rules and shows, live, how many people that is. The rules are plain data (see audience.ts), so the
// same ones are re-resolved by the send function; this page only decides what to ask for.
export default function AudienceBuilder({ audience, onChange, people, suppressedEmails, channel, savedAudiences, onSaveAudience, onDeleteSaved, onPreview }) {
  const [savingName, setSavingName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const resolved = useMemo(() => resolveAudience(people, audience, { channel, suppressedEmails }), [people, audience, channel, suppressedEmails]);
  const excludedByReason = useMemo(() => {
    const counts = {};
    for (const e of resolved.excluded) counts[e.reason] = (counts[e.reason] ?? 0) + 1;
    return counts;
  }, [resolved]);

  const setGroup = (gi, patch) => onChange({ ...audience, groups: audience.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  const setCondition = (gi, ci, patch) =>
    setGroup(gi, { conditions: audience.groups[gi].conditions.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });

  function addCondition(gi, fieldKey) {
    if (!fieldKey) return;
    const def = fieldDef(fieldKey);
    setGroup(gi, { conditions: [...audience.groups[gi].conditions, { field: def.key, op: def.ops[0], value: defaultValue(def) }] });
  }

  function changeField(gi, ci, fieldKey) {
    const def = fieldDef(fieldKey);
    setCondition(gi, ci, { field: def.key, op: def.ops[0], value: defaultValue(def) });
  }

  async function saveCurrent() {
    if (!savingName.trim()) return;
    await onSaveAudience(savingName.trim());
    setSavingName("");
    setShowSave(false);
  }

  return (
    <div className="aud">
      <div className="aud__top">
        <div className="field">
          <label htmlFor="aud-saved">Saved audience</label>
          <select
            id="aud-saved"
            value=""
            onChange={(e) => {
              const found = savedAudiences.find((s) => s.id === e.target.value);
              if (found) onChange(found.audience);
            }}
          >
            <option value="">{savedAudiences.length ? "Choose one" : "None saved yet"}</option>
            {savedAudiences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="aud-preset">Start from a preset</label>
          <select
            id="aud-preset"
            value=""
            onChange={(e) => {
              const preset = AUDIENCE_PRESETS.find((p) => p.key === e.target.value);
              if (preset) onChange(JSON.parse(JSON.stringify(preset.audience)));
            }}
          >
            <option value="">Choose one</option>
            {AUDIENCE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="aud__save">
          {showSave ? (
            <>
              <input type="text" aria-label="Audience name" placeholder="Name this audience" value={savingName} onChange={(e) => setSavingName(e.target.value)} />
              <button type="button" className="btn btn-primary" onClick={saveCurrent} disabled={!savingName.trim()}>
                Save
              </button>
              <button type="button" className="btn-link" onClick={() => setShowSave(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setShowSave(true)}>
              Save as new
            </button>
          )}
        </div>
      </div>

      <div className="aud__groups">
        {audience.groups.map((group, gi) => (
          <div className="aud__group" key={gi}>
            <div className="aud__group-head">
              <span>People matching</span>
              <select aria-label="Match all or any" value={group.match} onChange={(e) => setGroup(gi, { match: e.target.value })}>
                <option value="all">ALL of these</option>
                <option value="any">ANY of these</option>
              </select>
              {audience.groups.length > 1 && (
                <button type="button" className="btn-link" onClick={() => onChange({ ...audience, groups: audience.groups.filter((_, i) => i !== gi) })}>
                  Remove group
                </button>
              )}
            </div>
            {group.conditions.length === 0 && <p className="meta aud__empty">No filters yet, so this group is everyone.</p>}
            {group.conditions.map((c, ci) => {
              const def = fieldDef(c.field);
              return (
                <div className="aud__condition" key={ci}>
                  <select aria-label="Field" value={c.field} onChange={(e) => changeField(gi, ci, e.target.value)}>
                    {FIELD_DEFS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Condition" value={c.op} onChange={(e) => setCondition(gi, ci, { op: e.target.value })}>
                    {def.ops.map((op) => (
                      <option key={op} value={op}>
                        {OP_LABEL[op]}
                      </option>
                    ))}
                  </select>
                  <ValueInput def={def} condition={c} onChange={(value) => setCondition(gi, ci, { value })} />
                  <button type="button" className="btn-link" aria-label="Remove filter" onClick={() => setGroup(gi, { conditions: group.conditions.filter((_, i) => i !== ci) })}>
                    <X size={14} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <select aria-label="Add filter" className="aud__add" value="" onChange={(e) => addCondition(gi, e.target.value)}>
              <option value="">Add filter</option>
              {FIELD_DEFS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="aud__foot">
          <button type="button" className="btn-link" onClick={() => onChange({ ...audience, groups: [...audience.groups, { match: "all", conditions: [] }] })}>
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" /> Add group
          </button>
          {audience.groups.length > 1 && (
            <label className="aud__combine">
              Groups combine with
              <select aria-label="Combine groups" value={audience.match} onChange={(e) => onChange({ ...audience, match: e.target.value })}>
                <option value="all">ALL</option>
                <option value="any">ANY</option>
              </select>
            </label>
          )}
          <button type="button" className="btn-link" onClick={() => onChange(JSON.parse(JSON.stringify(EMPTY_AUDIENCE)))}>
            Clear
          </button>
        </div>
      </div>

      <div className="aud__summary" role="status">
        <strong>{resolved.recipients.length}</strong> {resolved.recipients.length === 1 ? "person" : "people"} would receive this
        {resolved.excluded.length > 0 && (
          <span className="meta">
            {" "}
            · left out: {Object.entries(excludedByReason).map(([reason, n]) => `${n} ${EXCLUDE_LABEL[reason].toLowerCase()}`).join(", ")}
          </span>
        )}
        {onPreview && (
          <button type="button" className="btn-link" style={{ marginLeft: "var(--space-4)" }} onClick={() => onPreview(resolved)}>
            See who
          </button>
        )}
        {savedAudiences.length > 0 && (
          <span className="aud__saved-list">
            {savedAudiences.map((s) => (
              <span className="chip" key={s.id}>
                {s.name}
                <button type="button" aria-label={`Delete saved audience ${s.name}`} onClick={() => onDeleteSaved(s)}>
                  ✕
                </button>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
