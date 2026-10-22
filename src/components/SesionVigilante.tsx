import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UMBRAL_AVISO_MS, useRenovacionPorActividad } from '../hooks/useRenovacionPorActividad';
import { useAuthStore } from '../store/auth.store';

/**
 * Vive dentro de las rutas protegidas. Renueva la sesión mientras hay actividad, avisa cuando está por vencer
 * por inactividad y, si vence, la cierra y lleva al login con el aviso correspondiente.
 */
export function SesionVigilante() {
  const navigate = useNavigate();
  const restanteMs = useRenovacionPorActividad({
    alVencer: () => {
      useAuthStore.getState().clear('inactividad');
      navigate('/login', { replace: true });
    },
  });

  if (restanteMs === null || restanteMs <= 0 || restanteMs > UMBRAL_AVISO_MS) return null;
  const segundos = Math.ceil(restanteMs / 1000);
  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-amber-500/40 bg-[#1a1408] px-4 py-3 text-xs text-amber-200 shadow-lg"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Tu sesión vence en <strong>{segundos} s</strong> por inactividad. Mueve el mouse o presiona una tecla para
        continuar.
      </p>
    </div>
  );
}
