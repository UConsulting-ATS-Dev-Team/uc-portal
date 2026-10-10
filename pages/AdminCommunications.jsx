import { useCallback, useEffect, useState } from "react";
import { fetchPeople, fetchProviderStatus, fetchSavedAudiences, fetchTemplates, fetchMessages } from "../data/commsSync.js";
import { supabase } from "../data/supabaseClient.js";
import TabBar from "../components/admin/TabBar.jsx";
import Composer from "../components/comms/Composer.jsx";
import ImessageTab from "../components/comms/ImessageTab.jsx";
import { DraftsTab, TemplatesTab } from "../components/comms/DraftsTemplatesTabs.jsx";
import { LogsTab, ScheduledTab } from "../components/comms/LogsTab.jsx";
import { MailingListTab, UnsubscribesTab } from "../components/comms/MailingTabs.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import "../styles/jobDetail.css";
import "../styles/comms.css";

const TABS = [
  { key: "email", label: "Email" },
  { key: "slack", label: "Slack" },
  { key: "imessage", label: "iMessage" },
  { key: "drafts", label: "Drafts" },
  { key: "templates", label: "Templates" },
  { key: "logs", label: "Logs" },
  { key: "scheduled", label: "Scheduled" },
  { key: "mailing-list", label: "Mailing list" },
  { key: "unsubscribes", label: "Unsubscribes" },
  { key: "announcements", label: "Announcements" },
];

// Master communications: one place for everything an exec sends to the club. Email and Slack go through the send function (and
// stay switched off, saying why, until their accounts are connected); iMessage is written here and sent from the admin's own
// phone. Audiences, drafts, templates, the mailing list and the unsubscribe list all work with nothing connected.
export default function AdminCommunications() {
  const [tab, setTab] = useState("email");
  const [status, setStatus] = useState(null); // null while loading
  const [people, setPeople] = useState({ people: [], suppressedEmails: new Set() });
  const [peopleError, setPeopleError] = useState(null);
  const [savedAudiences, setSavedAudiences] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [prefill, setPrefill] = useState({ email: null, slack: null });
  const [scheduledCount, setScheduledCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [own, setOwn] = useState({ email: null, phone: null });

  const bump = () => setRefreshKey((k) => k + 1);

  const loadPeople = useCallback(() => {
    fetchPeople()
      .then((p) => {
        setPeople(p);
        setPeopleError(null);
        supabase.auth.getUser().then(({ data }) => {
          const me = p.people.find((x) => x.profileId === data.user?.id);
          setOwn({ email: data.user?.email ?? null, phone: me?.phone ?? null });
        });
      })
      .catch((e) => setPeopleError(e.message));
  }, []);

  const loadSaved = useCallback(() => {
    fetchSavedAudiences().then(setSavedAudiences).catch(() => {});
  }, []);
  const loadTemplates = useCallback(() => {
    fetchTemplates().then(setTemplates).catch(() => {});
  }, []);
  const loadScheduledCount = useCallback(() => {
    fetchMessages({ statuses: ["scheduled"] }).then((rows) => setScheduledCount(rows.length)).catch(() => {});
  }, []);

  useEffect(() => {
    loadPeople();
    loadSaved();
    loadTemplates();
    loadScheduledCount();
    // Not connected (or the function isn't deployed yet) reads the same: the sending buttons stay off.
    fetchProviderStatus({ slackChannels: true })
      .then(setStatus)
      .catch(() => setStatus({ email: { configured: false }, slack: { configured: false }, unsubscribeSecretSet: false, slackChannels: [] }));
  }, [loadPeople, loadSaved, loadTemplates, loadScheduledCount]);

  // A draft or a template opens in the tab of its own channel (iMessage has no saved items: it is written fresh each time).
  // Leaving the composer by any tab drops a draft or template that was loaded into it, so it doesn't come back on the next visit.
  function changeTab(next) {
    setPrefill({ email: null, slack: null });
    setTab(next);
  }

  function openDraft(draft) {
    if (draft.channel !== "imessage") setPrefill((p) => ({ ...p, [draft.channel]: draft }));
    setTab(draft.channel);
  }

  function useTemplate(template) {
    if (template.channel !== "imessage") setPrefill((p) => ({ ...p, [template.channel]: { subject: template.subject, body: template.body, templateId: template.id } }));
    setTab(template.channel);
  }

  const emailReady = status ? status.email.configured && status.unsubscribeSecretSet : false;
  const tabs = TABS.map((t) => (t.key === "scheduled" ? { ...t, count: scheduledCount } : t));

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-5)" }}>
        <div>
          <h1>Master communications</h1>
          <p className="meta">Send email, Slack messages and texts to members, alumni and your mailing list.</p>
        </div>
      </div>

      {status && !emailReady && (
        <div className="comms-banner" role="status">
          <strong>Email isn't connected yet.</strong> You can build audiences, write and preview messages, save drafts and templates, and manage the mailing list now.
          Sending, scheduling and test emails switch on as soon as the email account is connected.
        </div>
      )}
      {peopleError && <p className="meta" style={{ color: "var(--color-danger)" }}>{peopleError}</p>}

      <TabBar tabs={tabs} active={tab} onChange={changeTab} label="Communications" />

      <div className="comms-body">
        {(tab === "email" || tab === "slack") && (
          <Composer
            key={tab}
            channel={tab}
            people={people.people}
            suppressedEmails={people.suppressedEmails}
            status={status}
            ownEmail={own.email}
            savedAudiences={savedAudiences}
            onAudiencesChanged={loadSaved}
            templates={templates}
            initial={prefill[tab]}
            onQueued={() => {
              bump();
              loadScheduledCount();
            }}
            onDraftSaved={bump}
          />
        )}
        {tab === "imessage" && (
          <ImessageTab people={people.people} suppressedEmails={people.suppressedEmails} savedAudiences={savedAudiences} onAudiencesChanged={loadSaved} ownPhone={own.phone} />
        )}
        {tab === "drafts" && <DraftsTab onOpen={openDraft} refreshKey={refreshKey} />}
        {tab === "templates" && <TemplatesTab onUse={useTemplate} />}
        {tab === "logs" && <LogsTab refreshKey={refreshKey} />}
        {tab === "scheduled" && <ScheduledTab refreshKey={refreshKey} onChanged={loadScheduledCount} />}
        {tab === "mailing-list" && <MailingListTab onChanged={loadPeople} />}
        {tab === "unsubscribes" && <UnsubscribesTab onChanged={loadPeople} />}
        {tab === "announcements" && <AdminDashboard view="communications" embedded />}
      </div>
    </div>
  );
}
