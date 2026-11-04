/** Navegação entre páginas (D46), com o total do conjunto filtrado e não só da página. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginação">
      <button type="button" className="button--secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button type="button" className="button--secondary" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        Seguinte
      </button>
    </nav>
  );
}
