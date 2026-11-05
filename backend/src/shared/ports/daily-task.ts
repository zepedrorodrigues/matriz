/**
 * Trabalho extra da tarefa diária (architecture.md §5, DT13), registado por outro módulo e executado pelo
 * módulo Planeamento dentro do mesmo trinco, depois de terminar as sprints: no I11, os alertas de prazo
 * ultrapassado (RN30, CA07.7), do módulo Acompanhamento.
 */
export interface DailyTask {
  run(today: string): Promise<void>;
}

export const DAILY_TASK = Symbol('DAILY_TASK');
