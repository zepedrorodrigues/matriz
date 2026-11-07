import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Navegação entre páginas (D46), com o total do conjunto filtrado e não só da página. */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-end gap-2 px-4 py-3 text-sm text-muted-foreground">
      <Button variant="outline" size="sm" className="h-9" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <ChevronLeft aria-hidden="true" /> Anterior
      </Button>
      <span>
        Página {page} de {pages}
      </span>
      <Button variant="outline" size="sm" className="h-9" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        Seguinte <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
