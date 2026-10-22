/** Contratos de /api/admin/** (ver docs/api/CONTRATO_API.md). */

export interface Pagina<T> {
  contenido: T[];
  pagina: number; // base 0
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface UsuarioAdmin {
  id: number;
  username: string;
  nombres: string;
  apellidos: string;
  email: string;
  rol: string;
  activo: boolean;
  bloqueado: boolean;
  dicomPacienteId: string | null;
  permisos: string[];
}

export interface FiltroUsuarios {
  q?: string;
  rol?: string; // '' = todos
  activo?: boolean;
  pagina?: number;
  tamano?: number;
}

export interface NuevoUsuario {
  username: string;
  clave: string;
  nombres: string;
  apellidos: string;
  email: string;
  rol: 'MEDICO' | 'PACIENTE';
  dicomPacienteId?: string;
}

export interface EdicionUsuario {
  nombres: string;
  apellidos: string;
  email: string;
}

export interface PermisoCatalogo {
  codigo: string;
  descripcion: string | null;
}

export const PERMISO_ACCESO_ESTUDIOS = 'ACCESO_ESTUDIOS';

export interface EventoAuditoria {
  id: number;
  fecha: string; // ISO-8601 UTC
  tipo: string;
  resultado: 'EXITO' | 'FALLO' | string;
  idUsuario: number | null;
  username: string | null;
  rol: string | null;
  estudio: string | null;
  ip: string | null;
  detalle: string | null;
}

/** Mismos valores que TipoEvento.java. */
export const TIPOS_EVENTO = [
  'INICIO_SESION',
  'CIERRE_SESION',
  'APERTURA_ESTUDIO',
  'ACCESO_ESTUDIO_DENEGADO',
  'USUARIO_CREADO',
  'USUARIO_EDITADO',
  'USUARIO_ACTIVADO',
  'USUARIO_DESACTIVADO',
  'PERMISO_OTORGADO',
  'PERMISO_REVOCADO',
  'CLAVE_CAMBIADA',
  'CLAVE_RESTABLECIDA',
  'RECUPERACION_SOLICITADA',
  'RECUPERACION_COMPLETADA',
  'RECUPERACION_FALLIDA',
] as const;

export const ETIQUETA_EVENTO: Record<string, string> = {
  INICIO_SESION: 'Inicio de sesión',
  CIERRE_SESION: 'Cierre de sesión',
  APERTURA_ESTUDIO: 'Apertura de estudio',
  ACCESO_ESTUDIO_DENEGADO: 'Acceso a estudio denegado',
  USUARIO_CREADO: 'Cuenta creada',
  USUARIO_EDITADO: 'Cuenta editada',
  USUARIO_ACTIVADO: 'Cuenta activada',
  USUARIO_DESACTIVADO: 'Cuenta desactivada',
  PERMISO_OTORGADO: 'Permiso otorgado',
  PERMISO_REVOCADO: 'Permiso revocado',
  CLAVE_CAMBIADA: 'Clave cambiada',
  CLAVE_RESTABLECIDA: 'Clave restablecida',
  RECUPERACION_SOLICITADA: 'Recuperación solicitada',
  RECUPERACION_COMPLETADA: 'Recuperación completada',
  RECUPERACION_FALLIDA: 'Recuperación fallida',
};

export interface FiltroAuditoria {
  usuario?: string;
  tipo?: string; // '' = todos
  resultado?: string; // '' = todos
  estudio?: string;
  desde?: string; // valor de <input type="datetime-local">, en hora local
  hasta?: string;
  pagina?: number;
  tamano?: number;
}
