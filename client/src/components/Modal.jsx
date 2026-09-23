import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

// Accessible modal: Escape closes, focus moves in and returns on close,
// Tab stays inside, background scroll is locked.
export default function Modal({ open, onClose, title, children, wide = false }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const focusables = () =>
      dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusables()[0]?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab') {
        const items = [...focusables()];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 md:items-center md:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative my-auto w-full rounded-panel bg-canvas p-6 shadow-lift md:p-10 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="card-title">
            {title}
          </h2>
          <button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
