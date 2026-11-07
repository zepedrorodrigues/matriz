import { Pager } from './pager';

/** Navegação entre páginas (D46), com o total do conjunto filtrado e não só da página. */
export function Pagination(props: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  return <Pager {...props} />;
}
