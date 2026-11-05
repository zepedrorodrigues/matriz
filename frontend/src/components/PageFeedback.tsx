import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface Feedback {
  generation: number;
  owner: string | null;
  start: (owner: string) => void;
}

const PageFeedbackContext = createContext<Feedback>({ generation: 0, owner: null, start: () => {} });

/**
 * Coordena as mensagens de um ecrã com vários painéis (Ex. 8, caso 09): quando uma parte do ecrã começa
 * uma operação, as outras apagam o resultado das suas, para nunca ficar visível uma mensagem antiga ao
 * lado do resultado da nova operação.
 */
export function PageFeedbackProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ generation: number; owner: string | null }>({ generation: 0, owner: null });
  const start = useCallback((owner: string) => setState((s) => ({ generation: s.generation + 1, owner })), []);
  return <PageFeedbackContext.Provider value={{ ...state, start }}>{children}</PageFeedbackContext.Provider>;
}

/**
 * Devolve a função a chamar quando esta parte do ecrã começa uma operação; `onOtherStart` corre quando
 * outra parte começa uma. Fora de um PageFeedbackProvider, não faz nada.
 */
export function usePageFeedback(owner: string, onOtherStart: () => void): () => void {
  const { generation, owner: last, start } = useContext(PageFeedbackContext);
  const callback = useRef(onOtherStart);
  callback.current = onOtherStart;
  useEffect(() => {
    if (generation > 0 && last !== owner) callback.current();
  }, [generation, last, owner]);
  return useCallback(() => start(owner), [start, owner]);
}
