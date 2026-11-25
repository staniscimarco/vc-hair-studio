"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Finestra di conferma grafica (al posto del confirm del browser). */
export function ConfirmDialog({
  open,
  title,
  message,
  icon,
  preview,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  icon?: ReactNode;
  preview?: { title: string; body: string } | null;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  return (
    <>
      <button className="sheet-scrim" type="button" aria-label="Chiudi" onClick={() => !busy && onCancel()} />
      <div className="sheet-panel confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="conferma-titolo">
        <div className="sheet-handle" />
        <button className="icon-btn is-soft" style={{ position: "absolute", right: 16, top: 16, width: 36, height: 36 }} type="button" aria-label="Chiudi" onClick={() => !busy && onCancel()}>
          <X size={18} />
        </button>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          {icon ? <span className={`confirm-icon ${tone === "danger" ? "is-danger" : ""}`}>{icon}</span> : null}
          <h2 id="conferma-titolo" className="m-0">{title}</h2>
          {message ? <div className="note m-0 max-w-sm">{message}</div> : null}
        </div>
        {preview ? (
          <div className="push-preview" aria-label="Anteprima della notifica">
            <span className="push-preview-icon" aria-hidden />
            <div className="min-w-0">
              <p className="push-preview-app">VC Hair Studio · adesso</p>
              <strong>{preview.title}</strong>
              <p>{preview.body}</p>
            </div>
          </div>
        ) : null}
        <div className="mt-5 grid gap-2">
          <button
            className={`btn btn-block ${tone === "danger" ? "btn-danger-solid" : "btn-primary"}`}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Attendere…" : confirmLabel}
          </button>
          <button className="btn btn-soft btn-block" type="button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </>
  );
}
