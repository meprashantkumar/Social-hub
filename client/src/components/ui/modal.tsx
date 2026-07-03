import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-fade-up relative z-10 w-full max-w-md rounded-2xl border border-line bg-panel/95 p-6 shadow-2xl shadow-black/50"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface hover:text-ink"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {title && <h3 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h3>}
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
