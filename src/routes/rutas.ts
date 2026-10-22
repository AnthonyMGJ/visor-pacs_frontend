import type { Rol } from '../types/auth.types';

/** Pantalla de inicio de cada rol: el ADMIN va a la gestión de cuentas; médico y paciente, a sus estudios. */
export function rutaInicio(rol: Rol | null | undefined): string {
  return rol === 'ADMIN' ? '/admin' : '/studies';
}
