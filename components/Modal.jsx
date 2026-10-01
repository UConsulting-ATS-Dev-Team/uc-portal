import { useEffect, useRef } from "react";
import "../styles/modal.css";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared shell for the 9 action-modal components + Messages' "New
// conversation" picker (all funnel through this one file, so fixing it
// here covers all of them). Escape and backdrop-click both close.
//
// Real focus-trap + focus-return, closing a deliberate simplification
// this file's own comment used to flag -- neither existed at all before:
// Tab could escape the modal into the (still-visible, not scroll-
// locked) page behind it, and closing a modal never returned focus to
// whatever triggered it, both real gaps for keyboard/screen-reader use.
// Still deliberately no confirm-on-dirty prompt -- unrelated to keyboard
// operability, a separate simplification kept as-is.
export default function Modal({ title, onClose, children, footer, width = 600 }) {
  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;

    const focusable = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? modalRef.current)?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusables = Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      const returnTarget = previouslyFocusedRef.current;
      if (returnTarget && document.body.contains(returnTarget) && typeof returnTarget.focus === "function") {
        returnTarget.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()} ref={modalRef} tabIndex={-1}>
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
