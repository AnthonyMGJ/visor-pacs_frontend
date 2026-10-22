import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}

/** Diálogo modal accesible: role=dialog, se cierra con Esc o con la X. */
export function Modal({ titulo, onCerrar, children }: Props) {
  const idTitulo = useId();
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0d1522] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={idTitulo} className="text-lg font-bold text-white">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
