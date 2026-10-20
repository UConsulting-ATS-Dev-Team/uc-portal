import { useCallback, useEffect, useRef } from "react";
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
//
// Accidental dismissal is guarded: once something inside a form has been typed or changed, Escape, a click on the dimmed backdrop
// and the corner X ask "Discard your changes?" instead of closing. The footer's own Cancel and Save buttons call the page's
// onClose directly, so they are never asked. A pop-up that only searches or picks (nothing to lose) passes `guard={false}`.
export default function Modal({ title, onClose, children, footer, width = 600, guard = true }) {
  const modalRef = useRef(null);
  const touchedRef = useRef(false);
  const requestClose = useCallback(() => {
    if (guard && touchedRef.current && !window.confirm("Discard your changes?")) return;
    onClose();
  }, [guard, onClose]);
  const previouslyFocusedRef = useRef(null);

  // The page behind is dimmed by the backdrop and should not scroll under the dialog either: the modal is the only
  // thing to look at and interact with until it is closed.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;

    const focusable = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? modalRef.current)?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") {
        requestClose();
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
  }, [requestClose]);

  return (
    <div className="modal-backdrop" onClick={requestClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()} onInputCapture={() => (touchedRef.current = true)} onChangeCapture={() => (touchedRef.current = true)} ref={modalRef} tabIndex={-1}>
        <div className="modal__title-row">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="modal__close" onClick={requestClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
