import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

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
 * Diálogo na própria página, acessível: `alertdialog`, foco inicial em «Cancelar» e Escape para fechar.
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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="flex w-full max-w-md flex-col gap-4 rounded-xl border bg-card p-5 shadow-lg">
        <h2 id={titleId} className="m-0 text-lg font-semibold">
          {title}
        </h2>
        <div className="text-sm text-foreground/90 [&_p]:m-0 [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5">{children}</div>
        {error ? <p className="m-0 text-sm font-medium text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" ref={cancelRef} onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? 'A eliminar…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
