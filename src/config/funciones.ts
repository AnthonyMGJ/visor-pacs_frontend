/**
 * Interruptor de la recuperación de clave por correo (RF-09). Apagado por defecto: sin
 * VITE_RECUPERACION_HABILITADA=true no hay enlace en el login y las rutas no existen.
 * Debe coincidir con RECUPERACION_HABILITADA del backend (si el backend la tiene apagada, responde 404).
 * Se lee en cada llamada (no al cargar el módulo) para poder probarlo.
 */
export function recuperacionHabilitada(): boolean {
  return import.meta.env.VITE_RECUPERACION_HABILITADA === 'true';
}
