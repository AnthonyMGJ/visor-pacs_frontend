import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { useAuthStore } from '../store/auth.store';

const originalAdapter = api.defaults.adapter;

function adaptadorQueFallaCon(status: number, data: unknown = null) {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('fallo', 'ERR_BAD_REQUEST', config, undefined, {
        status,
        data,
        statusText: '',
        headers: {},
        config,
      }),
    );
}

describe('interceptores de api', () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/studies', assign });
    useAuthStore.getState().setSession('jwt-123', 900, 'MEDICO', 'Ana');
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.unstubAllGlobals();
  });

  it('envía el token como Bearer', async () => {
    let auth: unknown;
    api.defaults.adapter = async (config) => {
      auth = config.headers.Authorization;
      return { data: [], status: 200, statusText: 'OK', headers: {}, config };
    };
    await api.get('/api/dicomweb/studies');
    expect(auth).toBe('Bearer jwt-123');
  });

  it('un 401 fuera del login cierra la sesión y vuelve al login', async () => {
    api.defaults.adapter = adaptadorQueFallaCon(401);
    await expect(api.get('/api/dicomweb/studies')).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('un 401 deja el aviso "tu sesión terminó" para el login', async () => {
    api.defaults.adapter = adaptadorQueFallaCon(401);
    await expect(api.post('/api/auth/renovar')).rejects.toBeTruthy();
    expect(sessionStorage.getItem('pacs_motivo_salida')).toBe('sesion');
  });

  it('un 401 estando ya en /login no vuelve a redirigir', async () => {
    vi.stubGlobal('location', { pathname: '/login', assign });
    api.defaults.adapter = adaptadorQueFallaCon(401);
    await expect(api.get('/api/dicomweb/studies')).rejects.toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it('un 403 con CLAVE_TEMPORAL marca la sesión y lleva a cambiar la clave, sin cerrarla', async () => {
    api.defaults.adapter = adaptadorQueFallaCon(403, { codigo: 'CLAVE_TEMPORAL' });
    await expect(api.get('/api/dicomweb/studies')).rejects.toBeTruthy();
    expect(useAuthStore.getState()).toMatchObject({ token: 'jwt-123', debeCambiarClave: true });
    expect(assign).toHaveBeenCalledWith('/cambiar-clave');
  });

  it('un 403 con CLAVE_TEMPORAL estando ya en /cambiar-clave no redirige', async () => {
    vi.stubGlobal('location', { pathname: '/cambiar-clave', assign });
    api.defaults.adapter = adaptadorQueFallaCon(403, { codigo: 'CLAVE_TEMPORAL' });
    await expect(api.get('/api/auth/renovar')).rejects.toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it('un 403 con otro código no se confunde con la clave temporal', async () => {
    api.defaults.adapter = adaptadorQueFallaCon(403, { codigo: 'OTRO' });
    await expect(api.get('/api/admin/usuarios')).rejects.toBeTruthy();
    expect(useAuthStore.getState().debeCambiarClave).toBe(false);
  });

  it('un error de red (sin respuesta) no cierra la sesión', async () => {
    api.defaults.adapter = (config) => Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
    await expect(api.get('/api/dicomweb/studies')).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBe('jwt-123');
    expect(assign).not.toHaveBeenCalled();
  });

  it('un 401 del propio login NO redirige (es "clave incorrecta")', async () => {
    useAuthStore.getState().clear();
    api.defaults.adapter = adaptadorQueFallaCon(401);
    await expect(api.post('/api/auth/login', {})).rejects.toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it('un 403 NO cierra la sesión', async () => {
    api.defaults.adapter = adaptadorQueFallaCon(403);
    await expect(api.get('/api/dicomweb/studies/1.2.3')).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBe('jwt-123');
    expect(assign).not.toHaveBeenCalled();
  });
});
