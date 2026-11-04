import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação antes de uma ação irreversível (RN38: a interface pede confirmação antes de eliminar).
 * Diálogo na própria página, acessível: foco inicial em «Cancelar» e Escape para fechar.
 */
export function ConfirmDialog({ title, children, confirmLabel, busy, error, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <div>{children}</div>
        {error ? <p className="field__error">{error}</p> : null}
        <div className="actions">
          <button type="button" className="button--secondary" ref={cancelRef} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="button--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'A eliminar…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
