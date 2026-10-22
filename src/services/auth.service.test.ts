import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, apiPublica } from './api';
import {
  cambiarClave, detalleDelServidor, login, logout, mensajeDeError, mensajeDeErrorAdmin, mensajeDeErrorClave,
  esEnlaceInvalido, MENSAJE_RECUPERACION, mensajeDeErrorRecuperacion, renovar, restablecerClave, RolNoSoportadoError,
  solicitarRecuperacion,
} from './auth.service';
import { useAuthStore } from '../store/auth.store';

function errorHttp(status: number): AxiosError {
  return new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, { status } as AxiosResponse);
}

describe('login', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('guarda token, rol y nombre de un médico', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 900, rol: 'MEDICO', nombre: 'Ana Pérez' },
    });
    await login({ username: '  ana.perez ', password: 'clave-larga-123' });
    expect(post).toHaveBeenCalledWith('/api/auth/login', { username: 'ana.perez', password: 'clave-larga-123' });
    expect(useAuthStore.getState()).toMatchObject({ token: 'jwt', rol: 'MEDICO', nombre: 'Ana Pérez' });
  });

  it('guarda la sesión de un paciente', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { accessToken: 'jwt2', tokenType: 'Bearer', expiresIn: 900, rol: 'PACIENTE', nombre: 'Juan Díaz' },
    });
    await login({ username: 'juan.diaz', password: 'clave-larga-123' });
    expect(useAuthStore.getState().rol).toBe('PACIENTE');
  });

  it('rechaza un rol desconocido y NO guarda sesión', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 900, rol: 'AUDITOR', nombre: 'Root' },
    });
    await expect(login({ username: 'root', password: 'clave-larga-123' })).rejects.toBeInstanceOf(
      RolNoSoportadoError,
    );
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('propaga el error del backend sin guardar sesión', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(errorHttp(401));
    await expect(login({ username: 'x', password: 'y' })).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBeNull();
  });
});

describe('logout', () => {
  it('limpia la sesión local aunque el backend falle', async () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
    vi.spyOn(api, 'post').mockRejectedValue(errorHttp(500));
    await logout();
    expect(useAuthStore.getState().token).toBeNull();
  });
});

describe('mensajeDeError', () => {
  it.each([
    [401, 'Usuario o contraseña incorrectos.'],
    [403, 'No tienes permiso para ver este estudio.'],
    [423, 'La cuenta está bloqueada temporalmente. Intenta nuevamente más tarde.'],
    [400, 'Los datos ingresados no son válidos.'],
    [502, 'El servidor de imágenes no está disponible. Intenta nuevamente en unos minutos.'],
    [500, 'Ocurrió un error en el servidor. Intenta nuevamente.'],
  ])('estado %i', (estado, mensaje) => {
    expect(mensajeDeError(errorHttp(estado))).toBe(mensaje);
  });

  it('sin respuesta del servidor', () => {
    const sinRespuesta = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(mensajeDeError(sinRespuesta)).toMatch(/No se pudo conectar/);
  });

  it('rol no soportado y errores desconocidos', () => {
    expect(mensajeDeError(new RolNoSoportadoError())).toMatch(/no tiene acceso/);
    expect(mensajeDeError(new Error('x'))).toBe('Ocurrió un error inesperado.');
  });
});

function errorConDetalle(status: number, detail?: string, headers: Record<string, string> = {}): AxiosError {
  return new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: detail === undefined ? null : { detail },
    headers,
  } as unknown as AxiosResponse);
}

describe('login con ADMIN y clave temporal', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('acepta el rol ADMIN', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 900, rol: 'ADMIN', nombre: 'Luz Rojas' },
    });
    await login({ username: 'admin.demo', password: 'clave-larga-123' });
    expect(useAuthStore.getState()).toMatchObject({ token: 'jwt', rol: 'ADMIN', debeCambiarClave: false });
  });

  it('recuerda que la cuenta debe cambiar su clave temporal', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 900, rol: 'MEDICO', nombre: 'Ana', debeCambiarClave: true },
    });
    await login({ username: 'ana', password: 'Temporal23456789' });
    expect(useAuthStore.getState().debeCambiarClave).toBe(true);
  });
});

describe('renovar', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('pide un token nuevo y reemplaza el de la sesión conservando el rol', async () => {
    useAuthStore.getState().setSession('viejo', 60, 'MEDICO', 'Ana');
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { accessToken: 'nuevo', tokenType: 'Bearer', expiresIn: 900, rol: 'MEDICO', nombre: 'Ana' },
    });
    await renovar();
    expect(post).toHaveBeenCalledWith('/api/auth/renovar');
    const s = useAuthStore.getState();
    expect(s.token).toBe('nuevo');
    expect(s.rol).toBe('MEDICO');
    expect(s.expiresAt!).toBeGreaterThan(Date.now() + 800_000);
  });

  it('si falla, no toca la sesión actual', async () => {
    useAuthStore.getState().setSession('viejo', 60, 'MEDICO', 'Ana');
    vi.spyOn(api, 'post').mockRejectedValue(errorHttp(500));
    await expect(renovar()).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBe('viejo');
  });
});

describe('cambiarClave', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('envía las dos claves, guarda el token nuevo y levanta la marca de clave temporal', async () => {
    useAuthStore.getState().setSession('temporal', 900, 'MEDICO', 'Ana', true);
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { accessToken: 'definitivo', tokenType: 'Bearer', expiresIn: 900, rol: 'MEDICO', nombre: 'Ana', debeCambiarClave: false },
    });
    await cambiarClave('Temporal23456789', 'una-clave-nueva-123');
    expect(post).toHaveBeenCalledWith('/api/auth/cambiar-clave', {
      claveActual: 'Temporal23456789', claveNueva: 'una-clave-nueva-123',
    });
    expect(useAuthStore.getState()).toMatchObject({ token: 'definitivo', debeCambiarClave: false });
  });

  it('si el servidor la rechaza, la sesión sigue como estaba', async () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
    vi.spyOn(api, 'post').mockRejectedValue(errorConDetalle(400, 'La clave actual no es correcta.'));
    await expect(cambiarClave('x', 'una-clave-nueva-123')).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBe('t');
  });
});

describe('logout solo de este dispositivo', () => {
  it('pide soloEsta=true y limpia la sesión local', async () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: null });
    await logout(true);
    expect(post).toHaveBeenCalledWith('/api/auth/logout', null, { params: { soloEsta: true } });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('por defecto cierra todas las sesiones de la cuenta (sin parámetro)', async () => {
    useAuthStore.getState().setSession('t', 900, 'MEDICO', 'Ana');
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: null });
    await logout();
    expect(post).toHaveBeenCalledWith('/api/auth/logout', null, undefined);
  });
});

describe('mensajes de error nuevos', () => {
  it('429 indica cuántos segundos esperar cuando el servidor lo informa', () => {
    expect(mensajeDeError(errorConDetalle(429, undefined, { 'retry-after': '42' }))).toMatch(/Espera 42 segundos/);
    expect(mensajeDeError(errorConDetalle(429))).toMatch(/Espera un momento/);
  });

  it('detalleDelServidor devuelve el texto o null', () => {
    expect(detalleDelServidor(errorConDetalle(409, 'Ya existe un usuario con ese correo.'))).toBe('Ya existe un usuario con ese correo.');
    expect(detalleDelServidor(errorConDetalle(409))).toBeNull();
    expect(detalleDelServidor(new Error('x'))).toBeNull();
  });

  it('cambio de clave: 400 muestra el detalle, 423 y 401 tienen su texto', () => {
    expect(mensajeDeErrorClave(errorConDetalle(400, 'La clave actual no es correcta.'))).toBe('La clave actual no es correcta.');
    expect(mensajeDeErrorClave(errorConDetalle(400))).toBe('Los datos ingresados no son válidos.');
    expect(mensajeDeErrorClave(errorConDetalle(423))).toMatch(/bloqueada temporalmente/);
    expect(mensajeDeErrorClave(errorConDetalle(401))).toMatch(/sesión ya no está vigente/);
    expect(mensajeDeErrorClave(errorConDetalle(500))).toBe('Ocurrió un error en el servidor. Intenta nuevamente.');
  });

  it('administración: 400 y 409 muestran el detalle; 403 y 404 tienen texto propio', () => {
    expect(mensajeDeErrorAdmin(errorConDetalle(409, 'No puedes desactivar tu propia cuenta.'))).toBe('No puedes desactivar tu propia cuenta.');
    expect(mensajeDeErrorAdmin(errorConDetalle(400, 'El correo no tiene un formato válido.'))).toBe('El correo no tiene un formato válido.');
    expect(mensajeDeErrorAdmin(errorConDetalle(409))).toBe('La operación no se pudo completar.');
    expect(mensajeDeErrorAdmin(errorConDetalle(403))).toBe('No tienes permiso para esta operación.');
    expect(mensajeDeErrorAdmin(errorConDetalle(404))).toBe('El registro ya no existe.');
    expect(mensajeDeErrorAdmin(new AxiosError('Network Error', 'ERR_NETWORK'))).toMatch(/No se pudo conectar/);
  });
});


describe('recuperación de clave (RF-09)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('solicitarRecuperacion usa el cliente SIN sesión y recorta el correo', async () => {
    const publica = vi.spyOn(apiPublica, 'post').mockResolvedValue({ data: { mensaje: 'Revisa tu correo.' } });
    const conSesion = vi.spyOn(api, 'post');
    await expect(solicitarRecuperacion('  ana@clinica.pe ')).resolves.toBe('Revisa tu correo.');
    expect(publica).toHaveBeenCalledWith('/api/auth/olvide-clave', { email: 'ana@clinica.pe' });
    expect(conSesion).not.toHaveBeenCalled();
  });

  it('si el servidor no trae mensaje usa el genérico', async () => {
    vi.spyOn(apiPublica, 'post').mockResolvedValue({ data: {} });
    await expect(solicitarRecuperacion('a@b.pe')).resolves.toBe(MENSAJE_RECUPERACION);
  });

  it('restablecerClave manda token y clave nueva por el cliente sin sesión y no guarda sesión', async () => {
    useAuthStore.getState().clear();
    const publica = vi.spyOn(apiPublica, 'post').mockResolvedValue({ data: { mensaje: 'ok' } });
    await restablecerClave('tok', 'ClaveNueva-67890');
    expect(publica).toHaveBeenCalledWith('/api/auth/restablecer-clave', { token: 'tok', claveNueva: 'ClaveNueva-67890' });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('esEnlaceInvalido solo reconoce el 400 titulado "Enlace no válido"', () => {
    const e = (status: number, title?: string) =>
      new AxiosError('x', 'ERR', undefined, undefined, { status, data: { title } } as AxiosResponse);
    expect(esEnlaceInvalido(e(400, 'Enlace no válido'))).toBe(true);
    expect(esEnlaceInvalido(e(400, 'Datos inválidos'))).toBe(false);
    expect(esEnlaceInvalido(e(500, 'Enlace no válido'))).toBe(false);
    expect(esEnlaceInvalido(new Error('x'))).toBe(false);
  });

  it('mensajeDeErrorRecuperacion: 400 con detalle, 404 y el resto', () => {
    const e = (status: number, detail?: string) =>
      new AxiosError('x', 'ERR', undefined, undefined, { status, data: { detail } } as AxiosResponse);
    expect(mensajeDeErrorRecuperacion(e(400, 'La clave debe tener al menos 12 caracteres.'))).toBe('La clave debe tener al menos 12 caracteres.');
    expect(mensajeDeErrorRecuperacion(e(404))).toMatch(/no está disponible/);
    expect(mensajeDeErrorRecuperacion(e(429))).toMatch(/Demasiados intentos/);
  });
});
