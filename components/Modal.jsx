import { useEffect } from "react";
import "../styles/modal.css";

// Shared shell for the 5 action modals (wireframe 3c). Escape and
// backdrop-click both close -- skipping full focus-trapping and a
// confirm-on-dirty prompt for now (noted as a simplification, not
// silently dropped) since neither changes what the modal actually does,
// just how forgiving it is about accidental dismissal.
export default function Modal({ title, onClose, children, footer, width = 600 }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__title-row">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
