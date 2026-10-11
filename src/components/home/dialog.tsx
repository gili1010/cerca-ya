import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Dialog({ title, onClose, children, className, preventCancel = false }: { title: string; onClose: () => void; children: ReactNode; className?: string; preventCancel?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={ref} className={`dialog${className ? ` ${className}` : ""}`} aria-label={title} onCancel={event => { if (preventCancel) event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="dialog-close" onClick={onClose} aria-label="Cerrar ventana"><X size={20} /></button>{children}
  </dialog>;
}
