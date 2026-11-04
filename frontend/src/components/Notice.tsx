import type { ReactNode } from 'react';

/** Mensagem de estado (informação, sucesso, aviso ou erro), anunciada pelos leitores de ecrã. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  return (
    <p className={`notice notice--${tone}`} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
