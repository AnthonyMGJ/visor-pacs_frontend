import { useEffect, useRef, useState } from 'react';
import { renovar } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

/** Se renueva cuando faltan menos de este tiempo para que venza el token (el token dura 15 min). */
export const UMBRAL_RENOVACION_MS = 5 * 60 * 1000;
/** Con menos de este tiempo restante se avisa a la persona de que la sesión está por vencer. */
export const UMBRAL_AVISO_MS = 60 * 1000;
export const INTERVALO_REVISION_MS = 5 * 1000;

const EVENTOS_DE_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

interface Opciones {
  intervaloMs?: number;
  umbralRenovacionMs?: number;
  /** Se llama una vez cuando el token venció sin que hubiera actividad que lo renovara. */
  alVencer?: () => void;
}

/**
 * Mantiene viva la sesión mientras la persona trabaja (HU12): cuando al token le queda poco y hubo actividad
 * (mouse, teclado, toque, scroll) desde la última renovación, pide un token nuevo. Sin actividad no se renueva,
 * el token vence solo y la sesión se cierra por inactividad. Devuelve el tiempo restante del token, en ms.
 *
 * El servidor impone además un tope absoluto de duración: pasado ese tope, /renovar responde 401 y el
 * interceptor de api.ts devuelve al login. Un fallo de red al renovar no cierra la sesión: se reintenta.
 */
export function useRenovacionPorActividad({
  intervaloMs = INTERVALO_REVISION_MS,
  umbralRenovacionMs = UMBRAL_RENOVACION_MS,
  alVencer,
}: Opciones = {}): number | null {
  const [restanteMs, setRestanteMs] = useState<number | null>(null);
  const ultimaActividad = useRef(0);
  const ultimaRenovacion = useRef(Date.now());
  const renovando = useRef(false);
  const ultimaRevision = useRef(0);
  const vencio = useRef(false);
  const alVencerRef = useRef(alVencer);
  alVencerRef.current = alVencer;

  useEffect(() => {
    ultimaRenovacion.current = Date.now();
    vencio.current = false;

    const revisar = () => {
      ultimaRevision.current = Date.now();
      const { token, expiresAt, debeCambiarClave } = useAuthStore.getState();
      if (!token || !expiresAt) {
        setRestanteMs(null);
        return;
      }
      const restante = expiresAt - Date.now();
      setRestanteMs(restante);
      if (restante <= 0) {
        if (!vencio.current) {
          vencio.current = true;
          alVencerRef.current?.();
        }
        return;
      }
      if (debeCambiarClave || renovando.current) return;
      if (restante <= umbralRenovacionMs && ultimaActividad.current > ultimaRenovacion.current) {
        renovando.current = true;
        renovar()
          .then(() => {
            ultimaRenovacion.current = Date.now();
            const nuevo = useAuthStore.getState().expiresAt;
            setRestanteMs(nuevo ? nuevo - Date.now() : null);
          })
          .catch(() => {
            /* 401: el interceptor ya devolvió al login. Sin red u otro error: se reintenta en la próxima revisión. */
          })
          .finally(() => {
            renovando.current = false;
          });
      }
    };

    const alActividad = () => {
      const ahora = Date.now();
      // Actividad estrictamente posterior a la última renovación (si coinciden en el mismo ms, cuenta como nueva).
      ultimaActividad.current = Math.max(ahora, ultimaRenovacion.current + 1);
      // Si ya toca renovar, no esperar a la próxima revisión periódica; pero sin revisar en cada pixel del mouse.
      if (ahora - ultimaRevision.current > 1000) revisar();
    };

    revisar();
    const temporizador = setInterval(revisar, intervaloMs);
    for (const evento of EVENTOS_DE_ACTIVIDAD) {
      window.addEventListener(evento, alActividad, { passive: true });
    }
    return () => {
      clearInterval(temporizador);
      for (const evento of EVENTOS_DE_ACTIVIDAD) window.removeEventListener(evento, alActividad);
    };
  }, [intervaloMs, umbralRenovacionMs]);

  return restanteMs;
}
