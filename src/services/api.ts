import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

/**
 * URL base del backend. Por defecto vacía: las llamadas van a "/api/..." en el mismo origen y el
 * proxy de Vite (vite.config.ts) las reenvía al backend. Así no hay CORS y funciona igual desde el
 * celular. Define VITE_API_URL solo si el frontend se sirve aparte del backend (entonces el backend
 * debe permitir ese origen en CORS_ALLOWED_ORIGINS).
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

/**
 * Cliente SIN sesión para los endpoints públicos (recuperación de clave). No manda Authorization ni tiene el
 * interceptor del 401: un token viejo guardado en el navegador no debe sacar a la persona de la pantalla.
 */
export const apiPublica = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** El 403 de una cuenta con clave temporal trae codigo = CLAVE_TEMPORAL (ErrorSeguridadHandler). */
function esClaveTemporal(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 403) return false;
  const data = err.response.data as { codigo?: unknown } | null | undefined;
  return data?.codigo === 'CLAVE_TEMPORAL';
}

// 401 fuera del login: la sesión ya no vale (venció, la cerraron en otro dispositivo, desactivaron la cuenta o
// pasó el tope de duración) → volver al login avisando por qué.
// 403 normal: "no tienes permiso para esto", NO cierra la sesión.
// 403 con CLAVE_TEMPORAL: la cuenta debe cambiar su clave → pantalla de cambio de clave.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = axios.isAxiosError(err) ? (err.config?.url ?? '') : '';
    const esLogin = url.includes('/api/auth/login');
    if (axios.isAxiosError(err) && err.response?.status === 401 && !esLogin) {
      useAuthStore.getState().clear('sesion');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    } else if (esClaveTemporal(err)) {
      useAuthStore.getState().marcarClaveTemporal();
      if (window.location.pathname !== '/cambiar-clave') window.location.assign('/cambiar-clave');
    }
    return Promise.reject(err);
  },
);
