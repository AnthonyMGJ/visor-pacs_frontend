import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  pagina: number; // base 0
  totalPaginas: number;
  total: number;
  onCambiar: (pagina: number) => void;
}

export function Paginacion({ pagina, totalPaginas, total, onCambiar }: Props) {
  const ultima = Math.max(totalPaginas - 1, 0);
  const boton = 'rounded-lg border border-slate-800 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
      <span>{total} {total === 1 ? 'resultado' : 'resultados'}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={boton} aria-label="Página anterior" disabled={pagina <= 0}
          onClick={() => onCambiar(pagina - 1)}><ChevronLeft className="h-4 w-4" /></button>
        <span>Página {Math.min(pagina + 1, Math.max(totalPaginas, 1))} de {Math.max(totalPaginas, 1)}</span>
        <button type="button" className={boton} aria-label="Página siguiente" disabled={pagina >= ultima}
          onClick={() => onCambiar(pagina + 1)}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
