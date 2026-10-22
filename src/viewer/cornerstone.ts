import { init as iniciarNucleo } from '@cornerstonejs/core';
import { init as iniciarCargadorDicom } from '@cornerstonejs/dicom-image-loader';
import {
  addTool,
  AngleTool,
  init as iniciarHerramientas,
  LengthTool,
  PanTool,
  StackScrollTool,
  WindowLevelTool,
  ZoomTool,
} from '@cornerstonejs/tools';
import { useAuthStore } from '../store/auth.store';
import { decidirTexturaLiviana, type Almacen } from './gpu';

function almacenDePestana(): Almacen | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

let iniciada: Promise<void> | null = null;

/**
 * Prepara Cornerstone una sola vez: núcleo, cargador DICOM (con el token de la sesión en cada petición de
 * fotogramas) y las herramientas. Es seguro llamarla muchas veces.
 */
export function iniciarCornerstone(): Promise<void> {
  iniciada ??= (async () => {
    // En GPU de celular sin texturas decimales filtradas, las imágenes de 16 bits salían negras (ver gpu.ts).
    const liviana = decidirTexturaLiviana(window.location.search, almacenDePestana());
    console.info(`Visor: texturas ${liviana ? 'livianas (medio flotante)' : 'normales'}`);
    await iniciarNucleo({ rendering: { preferSizeOverAccuracy: liviana } } as Parameters<typeof iniciarNucleo>[0]);
    iniciarCargadorDicom({
      maxWebWorkers: Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2))),
      // Los fotogramas pasan por el proxy del backend: llevan el mismo token que el resto de la API.
      beforeSend: () => {
        const cabeceras: Record<string, string> = {};
        const token = useAuthStore.getState().token;
        if (token) cabeceras.Authorization = `Bearer ${token}`;
        return cabeceras;
      },
      // Estas peticiones no pasan por axios, así que el 401 (sesión vencida) se atiende aquí.
      errorInterceptor: (error) => {
        if (error.status === 401) {
          useAuthStore.getState().clear('sesion');
          if (window.location.pathname !== '/login') window.location.assign('/login');
        }
      },
    });
    iniciarHerramientas();
    for (const herramienta of [WindowLevelTool, PanTool, ZoomTool, StackScrollTool, LengthTool, AngleTool]) {
      addTool(herramienta);
    }
  })().catch((e) => {
    iniciada = null; // permite reintentar si falló (por ejemplo, sin WebGL)
    throw e;
  });
  return iniciada;
}
