"use client";

import { useEffect, useRef } from "react";

// Panel inferior con la explicación tras un fallo. Se cierra con la ✕, con
// el botón, tocando fuera o con Escape; en todos los casos llama a onClose.
export default function ExplanationSheet({ open, explanation, onClose }) {
  const ctaRef = useRef(null);
  // Conserva el último texto para que no se vacíe mientras se desvanece
  const shown = useRef(explanation);
  if (explanation) shown.current = explanation;

  useEffect(() => {
    if (open) ctaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`fixed inset-0 z-10 flex items-end justify-center bg-[rgba(10,9,8,0.72)] px-[0.9rem] pb-[env(safe-area-inset-bottom,0px)] transition-[opacity,visibility] duration-200 ease-in-out ${
        open ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={`w-full max-w-[460px] rounded-t-[10px] border border-b-0 border-line bg-paper px-6 pb-[calc(1.6rem_+_env(safe-area-inset-bottom,0px))] pt-[1.6rem] transition-transform duration-200 ease-in-out ${
          open ? "translate-y-0" : "translate-y-4"
        }`}
      >
        <div className="mb-[0.9rem] flex items-center justify-between">
          <span id="sheet-title" className="text-xs tracking-[0.03em] text-accent-soft">
            No exactamente
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-[30px] w-[30px] rounded-full border border-line text-base leading-none text-ink-dim hover:border-ink-dim hover:text-ink"
          >
            ✕
          </button>
        </div>
        {/* Contenido propio de la BD (solo <b>), no de usuarios */}
        <p
          className="mb-[1.3rem] text-[0.98rem] leading-[1.55] text-ink [&_b]:font-semibold [&_b]:text-accent-soft"
          dangerouslySetInnerHTML={{ __html: shown.current ?? "" }}
        />
        <button
          ref={ctaRef}
          type="button"
          onClick={onClose}
          className="w-full rounded-[5px] bg-accent p-[0.85rem] text-[0.95rem] font-medium text-[#f4ede6] hover:bg-accent-hover"
        >
          Entendido, seguir
        </button>
      </div>
    </div>
  );
}
