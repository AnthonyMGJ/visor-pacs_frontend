import axios from 'axios';
import { api, apiPublica } from './api';
import { useAuthStore } from '../store/auth.store';
import { esRolValido, type LoginRequest, type LoginResponse } from '../types/auth.types';

/** La cuenta existe y la clave es correcta, pero su rol no tiene acceso a esta aplicación. */
export class RolNoSoportadoError extends Error {
  constructor() {
    super('Rol no soportado por esta aplicación.');
    this.name = 'RolNoSoportadoError';
  }
}

/** Mismo mínimo que el backend (UsuarioService.CLAVE_MINIMA). */
export const CLAVE_MINIMA = 12;

function guardarSesion(data: LoginResponse): void {
  const { accessToken, expiresIn, rol, nombre, debeCambiarClave } = data;
  if (!esRolValido(rol)) {
    // No se guarda nada: un rol desconocido (p. ej. uno futuro) no entra a la aplicación.
    throw new RolNoSoportadoError();
  }
  useAuthStore.getState().setSession(accessToken, expiresIn, rol, nombre, debeCambiarClave === true);
}

export async function login(data: LoginRequest): Promise<void> {
  const res = await api.post<LoginResponse>('/api/auth/login', {
    username: data.username.trim(),
    password: data.password,
  });
  guardarSesion(res.data);
}

/**
 * Pide un token nuevo con la sesión vigente (la sesión sigue mientras haya actividad). Si el servidor responde
 * 401 (sesión revocada o tope de duración alcanzado), el interceptor de api.ts devuelve al login.
 */
export async function renovar(): Promise<void> {
  const res = await api.post<LoginResponse>('/api/auth/renovar');
  guardarSesion(res.data);
}

/** Cambia la clave de la cuenta; el servidor cierra las demás sesiones y devuelve un token nuevo. */
export async function cambiarClave(claveActual: string, claveNueva: string): Promise<void> {
  const res = await api.post<LoginResponse>('/api/auth/cambiar-clave', { claveActual, claveNueva });
  guardarSesion(res.data);
}

/** Pide el correo de recuperación (RF-09). El servidor responde igual exista o no la cuenta. */
export async function solicitarRecuperacion(email: string): Promise<string> {
  const res = await apiPublica.post<{ mensaje?: string }>('/api/auth/olvide-clave', { email: email.trim() });
  return res.data?.mensaje ?? MENSAJE_RECUPERACION;
}

/** Fija la clave nueva con el token del correo (RF-09). No inicia sesión. */
export async function restablecerClave(token: string, claveNueva: string): Promise<void> {
  await apiPublica.post('/api/auth/restablecer-clave', { token, claveNueva });
}

/** Texto de respaldo si el servidor no trae mensaje; igual para cualquier correo. */
export const MENSAJE_RECUPERACION =
  'Si el correo está registrado, te enviaremos las instrucciones en unos minutos. Revisa también tu carpeta de spam.';

/** soloEsta=true cierra únicamente este dispositivo; por defecto el servidor cierra todas las sesiones de la cuenta. */
export async function logout(soloEsta = false): Promise<void> {
  try {
    await api.post('/api/auth/logout', null, soloEsta ? { params: { soloEsta: true } } : undefined);
  } catch {
    /* aunque falle, se cierra la sesión local */
  } finally {
    useAuthStore.getState().clear();
  }
}

/** Texto del problema+json del backend (campo "detail"), si lo hay. Nunca incluye datos sensibles. */
export function detalleDelServidor(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const detail = (err.response?.data as { detail?: unknown } | null | undefined)?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : null;
}

function segundosDeEspera(err: unknown): number | null {
  if (!axios.isAxiosError(err)) return null;
  const valor = Number(err.response?.headers?.['retry-after']);
  return Number.isFinite(valor) && valor > 0 ? Math.ceil(valor) : null;
}

/**
 * Traduce los errores del backend (ProblemDetail 400/401/403/423/429/502) a un mensaje para el usuario.
 * El 401 fuera del login lo maneja el interceptor de api.ts (vuelve al login).
 */
export function mensajeDeError(err: unknown): string {
  if (err instanceof RolNoSoportadoError) {
    return 'Tu cuenta no tiene acceso a esta aplicación.';
  }
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'No se pudo conectar con el servidor. Verifica que el backend esté activo.';
    switch (err.response.status) {
      case 401: return 'Usuario o contraseña incorrectos.';
      case 403: return 'No tienes permiso para ver este estudio.';
      case 423: return 'La cuenta está bloqueada temporalmente. Intenta nuevamente más tarde.';
      case 429: {
        const espera = segundosDeEspera(err);
        return espera
          ? `Demasiados intentos desde tu red. Espera ${espera} segundos e inténtalo de nuevo.`
          : 'Demasiados intentos desde tu red. Espera un momento e inténtalo de nuevo.';
      }
      case 400: return 'Los datos ingresados no son válidos.';
      case 502: return 'El servidor de imágenes no está disponible. Intenta nuevamente en unos minutos.';
      default: return 'Ocurrió un error en el servidor. Intenta nuevamente.';
    }
  }
  return 'Ocurrió un error inesperado.';
}

/** Mensajes del cambio de clave: aquí un 400 es "clave actual incorrecta" o "clave nueva inválida". */
export function mensajeDeErrorClave(err: unknown): string {
  if (axios.isAxiosError(err) && err.response) {
    const detalle = detalleDelServidor(err);
    if (err.response.status === 400) return detalle ?? 'Los datos ingresados no son válidos.';
    if (err.response.status === 423) return 'La cuenta está bloqueada temporalmente por intentos fallidos. Intenta más tarde.';
    if (err.response.status === 401) return 'Tu sesión ya no está vigente. Inicia sesión nuevamente.';
  }
  return mensajeDeError(err);
}

/** El enlace de recuperación no sirve (venció, ya se usó o no existe): el servidor responde 400 con el título "Enlace no válido". */
export function esEnlaceInvalido(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 400) return false;
  return (err.response.data as { title?: unknown } | null | undefined)?.title === 'Enlace no válido';
}

/** Mensajes de la recuperación de clave. 404 = función desactivada en el servidor. */
export function mensajeDeErrorRecuperacion(err: unknown): string {
  if (axios.isAxiosError(err) && err.response) {
    if (err.response.status === 400) return detalleDelServidor(err) ?? 'Los datos ingresados no son válidos.';
    if (err.response.status === 404) return 'La recuperación de clave no está disponible. Contacta al administrador.';
  }
  return mensajeDeError(err);
}

/** Mensajes de las operaciones de administración: 400 y 409 traen un detalle redactado para mostrarse. */
export function mensajeDeErrorAdmin(err: unknown): string {
  if (axios.isAxiosError(err) && err.response) {
    const detalle = detalleDelServidor(err);
    switch (err.response.status) {
      case 400:
      case 409:
        return detalle ?? 'La operación no se pudo completar.';
      case 403: return 'No tienes permiso para esta operación.';
      case 404: return 'El registro ya no existe.';
    }
  }
  return mensajeDeError(err);
}
