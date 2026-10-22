export interface LoginRequest {
  username: string;
  password: string;
}

/** Roles que la aplicación sabe manejar (Roles.java en el backend). */
export type Rol = 'MEDICO' | 'PACIENTE' | 'ADMIN';

export const ROLES_VALIDOS: readonly Rol[] = ['MEDICO', 'PACIENTE', 'ADMIN'];

/** Roles que ven imágenes (el ADMIN gestiona cuentas y auditoría, pero nunca ve imágenes). */
export const ROLES_CON_IMAGENES: readonly Rol[] = ['MEDICO', 'PACIENTE'];

export const ETIQUETA_ROL: Record<Rol, string> = {
  MEDICO: 'Médico',
  PACIENTE: 'Paciente',
  ADMIN: 'Administrador',
};

export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES_VALIDOS as readonly string[]).includes(valor);
}

/**
 * Respuesta de POST /api/auth/login, /renovar y /cambiar-clave (LoginResponse.java). expiresIn está en segundos.
 * `rol` llega como texto: se valida con esRolValido antes de guardarlo.
 * debeCambiarClave: la cuenta tiene una clave temporal; hasta cambiarla, el token solo sirve para eso.
 */
export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  rol: string;
  nombre: string;
  debeCambiarClave?: boolean;
}
