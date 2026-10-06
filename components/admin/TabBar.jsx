import "../../styles/comms.css";

// The row of tabs at the top of the multi-part admin pages (Communications, Analytics). Controlled: the page owns which is open.
export default function TabBar({ tabs, active, onChange, label }) {
  return (
    <div className="admin-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`admin-tabs__tab${active === tab.key ? " is-active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count > 0 && <span className="admin-tabs__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
