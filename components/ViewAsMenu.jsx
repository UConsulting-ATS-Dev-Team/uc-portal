import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAppState } from "../data/store.jsx";

const OPTIONS = [
  { value: null, label: "Admin (real)" },
  { value: "current_member", label: "Current member" },
  { value: "alumni", label: "Alumni" },
  { value: "intern", label: "Intern" },
];

// Real admin-only simulation control -- direct ask: test each member
// type's experience without creating a separate throwaway account for
// each one. Purely a client-side presentation override
// (data/store.jsx's viewAsOverride, sessionStorage-backed): it only ever
// changes what isAdmin/isAlumni/isIntern resolve to for THIS browser tab,
// never this admin's real profiles.role/member_status. Every real RLS
// policy and is_admin()-gated RPC keeps checking the true signed-in
// session server-side regardless, so "viewing as Member" can never
// actually grant or remove a real capability -- it only changes what the
// UI shows and which routes redirect where, exactly like a real member
// would see.
export default function ViewAsMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { viewAsOverride, setViewAs } = useAppState();
  const current = OPTIONS.find((o) => o.value === viewAsOverride) ?? OPTIONS[0];

  return (
    <div className="view-as-menu">
      <button
        type="button"
        className={`chip${viewAsOverride ? " chip-demo" : " chip-accent"}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={viewAsOverride ? "Simulated view. Your real account is still an admin" : "Click to preview another member type's view"}
      >
        {viewAsOverride ? `Viewing as: ${current.label}` : "Admin"}
        {/* Real ask: nothing about a plain chip read as clickable --
            a visible chevron is the standard "this opens a menu" signal,
            rotating 180° while open so it also confirms the state. */}
        <ChevronDown size={14} strokeWidth={2} className={`view-as-menu__chevron${open ? " is-open" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="view-as-menu__panel" role="menu" onMouseLeave={() => setOpen(false)}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="menuitem"
              className={opt.value === viewAsOverride ? "is-active" : ""}
              onClick={() => {
                setViewAs(opt.value);
                setOpen(false);
                // Switching type always lands on that type's own home so the change is visible: "/" is Home for
                // members and admins, and the route guards send alumni on to /feed and interns to /accelerator.
                navigate("/");
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
