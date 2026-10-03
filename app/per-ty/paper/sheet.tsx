"use client";

// A bottom sheet on phones, a centred card on desktops. Built on <dialog> for
// the focus trap, Esc and the inert page behind it; dragged down by its handle
// to close, like the sheets the reader's phone already has. Only the handle
// drags, so scrolling the sheet's own content never closes it by accident.

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useDragControls, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

export default function Sheet({
  open,
  onClose,
  title,
  titleId,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  titleId: string;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useDragControls();
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={`perty-sheet${className ? ` ${className}` : ""}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A tap on the backdrop closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="perty-sheet-panel"
        drag={reduce ? false : "y"}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <div
          className="perty-sheet-handle"
          onPointerDown={(e) => drag.start(e)}
          aria-hidden="true"
        >
          <i />
        </div>
        <header className="perty-sheet-head">
          {/* Focus lands on the title, not the close button: a ring on "X" the
              moment the sheet opens reads as an error on a phone. */}
          <h2 id={titleId} tabIndex={-1} autoFocus>
            {title}
          </h2>
          <button type="button" className="perty-icon-btn" onClick={onClose} aria-label="Mbyll">
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>
        <div className="perty-sheet-body">{children}</div>
      </motion.div>
    </dialog>
  );
}
