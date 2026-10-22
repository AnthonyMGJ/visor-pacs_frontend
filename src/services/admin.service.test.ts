import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import {
  aInstanteUtc, cambiarEstado, crearUsuario, editarUsuario, listarAuditoria, listarPermisos, listarUsuarios,
  otorgarPermiso, restablecerClave, revocarPermiso,
} from './admin.service';

const pagina = { contenido: [], pagina: 0, tamano: 20, total: 0, totalPaginas: 0 };

describe('admin.service', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('listarUsuarios manda solo los filtros con valor y la página base 0', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: pagina });
    await listarUsuarios({ q: '  ana ', rol: '', activo: false, pagina: 2 });
    expect(get).toHaveBeenCalledWith('/api/admin/usuarios', { params: { q: 'ana', activo: false, pagina: 2, tamano: 20 } });
  });

  it('listarUsuarios sin filtros pide la primera página', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: pagina });
    await listarUsuarios();
    expect(get).toHaveBeenCalledWith('/api/admin/usuarios', { params: { pagina: 0, tamano: 20 } });
  });

  it('crearUsuario de un médico no envía dicomPacienteId', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 5 } });
    await crearUsuario({ username: 'a.b', clave: 'una-clave-larga-1', nombres: 'A', apellidos: 'B', email: 'a@b.pe', rol: 'MEDICO', dicomPacienteId: 'X' });
    expect(post).toHaveBeenCalledWith('/api/admin/usuarios', {
      username: 'a.b', clave: 'una-clave-larga-1', nombres: 'A', apellidos: 'B', email: 'a@b.pe', rol: 'MEDICO',
    });
  });

  it('crearUsuario de un paciente envía su PatientID', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 5 } });
    await crearUsuario({ username: 'j.d', clave: 'una-clave-larga-1', nombres: 'J', apellidos: 'D', email: 'j@d.pe', rol: 'PACIENTE', dicomPacienteId: 'PRUEBA-0001' });
    expect(post.mock.calls[0]![1]).toMatchObject({ rol: 'PACIENTE', dicomPacienteId: 'PRUEBA-0001' });
  });

  it('editar, cambiar estado y permisos usan las rutas del contrato', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
    const del = vi.spyOn(api, 'delete').mockResolvedValue({ data: {} });

    await editarUsuario(7, { nombres: 'A', apellidos: 'B', email: 'a@b.pe' });
    await cambiarEstado(7, false);
    await otorgarPermiso(7, 'ACCESO_ESTUDIOS');
    await revocarPermiso(7, 'ACCESO_ESTUDIOS');

    expect(put).toHaveBeenNthCalledWith(1, '/api/admin/usuarios/7', { nombres: 'A', apellidos: 'B', email: 'a@b.pe' });
    expect(patch).toHaveBeenCalledWith('/api/admin/usuarios/7/estado', { activo: false });
    expect(put).toHaveBeenNthCalledWith(2, '/api/admin/usuarios/7/permisos/ACCESO_ESTUDIOS');
    expect(del).toHaveBeenCalledWith('/api/admin/usuarios/7/permisos/ACCESO_ESTUDIOS');
  });

  it('listarPermisos y restablecerClave', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [{ codigo: 'ACCESO_ESTUDIOS', descripcion: 'x' }] });
    expect(await listarPermisos()).toEqual([{ codigo: 'ACCESO_ESTUDIOS', descripcion: 'x' }]);

    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { claveTemporal: 'Temporal23456789' } });
    expect(await restablecerClave(7)).toBe('Temporal23456789');
    expect(post).toHaveBeenCalledWith('/api/admin/usuarios/7/restablecer-clave');
  });

  it('listarAuditoria convierte las fechas locales a instantes UTC y omite lo vacío', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: pagina });
    await listarAuditoria({ usuario: 'ana', tipo: 'INICIO_SESION', resultado: '', estudio: '', desde: '2026-10-16T00:00', hasta: '' });
    const params = get.mock.calls[0]![1]!.params as Record<string, unknown>;
    expect(get.mock.calls[0]![0]).toBe('/api/admin/auditoria');
    expect(params).toMatchObject({ usuario: 'ana', tipo: 'INICIO_SESION', pagina: 0, tamano: 20 });
    expect(params.desde).toBe(new Date('2026-10-16T00:00').toISOString());
    expect(params).not.toHaveProperty('hasta');
    expect(params).not.toHaveProperty('resultado');
    expect(params).not.toHaveProperty('estudio');
  });

  it('aInstanteUtc tolera vacíos y valores inválidos', () => {
    expect(aInstanteUtc(undefined)).toBeUndefined();
    expect(aInstanteUtc('')).toBeUndefined();
    expect(aInstanteUtc('no-es-fecha')).toBeUndefined();
    expect(aInstanteUtc('2026-10-16T10:30')).toMatch(/^2026-10-16T\d\d:30:00\.000Z$/);
  });
});
