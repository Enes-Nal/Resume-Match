import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/** Centered modal sheet on Paper Frost with a blurred backdrop. */
export const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }> = ({
  open,
  onClose,
  title,
  children,
  wide,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 no-print">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[6px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[92vh] overflow-y-auto bg-frost rounded-t-[28px] sm:rounded-[28px] ring-1 ring-control animate-fade-up`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-7 pt-6 pb-4 bg-frost/90 backdrop-blur-xl">
          <h3 className="t-title">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-control/80 hover:bg-control flex items-center justify-center text-slate">
            <X size={16} />
          </button>
        </div>
        <div className="px-7 pb-8">{children}</div>
      </div>
    </div>
  );
};
