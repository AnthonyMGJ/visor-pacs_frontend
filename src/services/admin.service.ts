import { api } from './api';
import type {
  EdicionUsuario,
  EventoAuditoria,
  FiltroAuditoria,
  FiltroUsuarios,
  NuevoUsuario,
  Pagina,
  PermisoCatalogo,
  UsuarioAdmin,
} from '../types/admin.types';

/** Quita los filtros vacíos para no mandar "?q=&rol=" al servidor. */
function sinVacios(obj: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean> {
  const salida: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
    salida[k] = typeof v === 'string' ? v.trim() : v;
  }
  return salida;
}

/** Convierte el valor de un <input type="datetime-local"> (hora local) al instante ISO-8601 UTC que pide el backend. */
export function aInstanteUtc(valorLocal: string | undefined): string | undefined {
  if (!valorLocal) return undefined;
  const fecha = new Date(valorLocal);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
}

export async function listarUsuarios(f: FiltroUsuarios = {}): Promise<Pagina<UsuarioAdmin>> {
  const res = await api.get<Pagina<UsuarioAdmin>>('/api/admin/usuarios', {
    params: sinVacios({ q: f.q, rol: f.rol, activo: f.activo, pagina: f.pagina ?? 0, tamano: f.tamano ?? 20 }),
  });
  return res.data;
}

export async function crearUsuario(datos: NuevoUsuario): Promise<UsuarioAdmin> {
  const cuerpo: Record<string, string> = { ...datos } as Record<string, string>;
  if (datos.rol !== 'PACIENTE' || !datos.dicomPacienteId?.trim()) delete cuerpo.dicomPacienteId;
  const res = await api.post<UsuarioAdmin>('/api/admin/usuarios', cuerpo);
  return res.data;
}

export async function editarUsuario(id: number, datos: EdicionUsuario): Promise<UsuarioAdmin> {
  const res = await api.put<UsuarioAdmin>(`/api/admin/usuarios/${id}`, datos);
  return res.data;
}

export async function cambiarEstado(id: number, activo: boolean): Promise<UsuarioAdmin> {
  const res = await api.patch<UsuarioAdmin>(`/api/admin/usuarios/${id}/estado`, { activo });
  return res.data;
}

export async function listarPermisos(): Promise<PermisoCatalogo[]> {
  const res = await api.get<PermisoCatalogo[]>('/api/admin/permisos');
  return res.data;
}

export async function otorgarPermiso(id: number, codigo: string): Promise<UsuarioAdmin> {
  const res = await api.put<UsuarioAdmin>(`/api/admin/usuarios/${id}/permisos/${encodeURIComponent(codigo)}`);
  return res.data;
}

export async function revocarPermiso(id: number, codigo: string): Promise<UsuarioAdmin> {
  const res = await api.delete<UsuarioAdmin>(`/api/admin/usuarios/${id}/permisos/${encodeURIComponent(codigo)}`);
  return res.data;
}

/** Devuelve la clave temporal en claro: se muestra una sola vez, el servidor no la conserva. */
export async function restablecerClave(id: number): Promise<string> {
  const res = await api.post<{ claveTemporal: string }>(`/api/admin/usuarios/${id}/restablecer-clave`);
  return res.data.claveTemporal;
}

export async function listarAuditoria(f: FiltroAuditoria = {}): Promise<Pagina<EventoAuditoria>> {
  const res = await api.get<Pagina<EventoAuditoria>>('/api/admin/auditoria', {
    params: sinVacios({
      usuario: f.usuario,
      tipo: f.tipo,
      resultado: f.resultado,
      estudio: f.estudio,
      desde: aInstanteUtc(f.desde),
      hasta: aInstanteUtc(f.hasta),
      pagina: f.pagina ?? 0,
      tamano: f.tamano ?? 20,
    }),
  });
  return res.data;
}
