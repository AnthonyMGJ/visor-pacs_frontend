/**
 * Detección de GPUs que no pueden dibujar imágenes DICOM de 16 bits con texturas de 32 bits filtradas.
 *
 * Cornerstone sube las imágenes de 16 bits como textura decimal de 32 bits y la filtra de forma lineal.
 * Muchas GPU de celular no tienen esa capacidad (extensión OES_texture_float_linear): la textura queda
 * "incompleta" y la imagen se ve negra aunque se haya descargado bien. En ese caso conviene usar texturas de
 * 16 bits decimales ("medio flotante"), que todos los navegadores con WebGL 2 filtran. Con imágenes de 12 bits
 * (0–4095) el error de redondeo es de hasta 2 niveles de gris: aceptable para imágenes de referencia.
 */

/** Lo mínimo que se usa de un contexto WebGL (facilita probarlo sin navegador). */
export interface ContextoGl {
  getExtension(nombre: string): unknown;
}

/** true si hay que pedir texturas livianas (medio flotante) para que la imagen no salga negra. */
export function necesitaTexturaLiviana(gl: ContextoGl | null | undefined): boolean {
  if (!gl) return false; // sin WebGL, Cornerstone ya pasa al dibujo por CPU
  try {
    return !gl.getExtension('OES_texture_float_linear');
  } catch {
    return false;
  }
}

export type ModoTextura = 'liviana' | 'normal' | undefined;

/** Lo mínimo que se usa del almacenamiento de la pestaña (sessionStorage). */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

const CLAVE = 'visor.gpu';

const valido = (v: string | null): ModoTextura => (v === 'liviana' || v === 'normal' ? v : undefined);

/**
 * Lee ?gpu=liviana o ?gpu=normal de la dirección; sirve para comparar en un dispositivo sin recompilar.
 * Se guarda en la pestaña porque al iniciar sesión la aplicación cambia de dirección y el parámetro se pierde.
 */
export function modoTexturaForzado(busqueda: string, almacen?: Almacen): ModoTextura {
  const enDireccion = valido(new URLSearchParams(busqueda).get('gpu'));
  try {
    if (enDireccion) {
      almacen?.setItem(CLAVE, enDireccion);
      return enDireccion;
    }
    return valido(almacen?.getItem(CLAVE) ?? null);
  } catch {
    return enDireccion; // almacenamiento bloqueado: se usa solo lo de la dirección
  }
}

/** Decide si se usan texturas livianas: lo forzado en la dirección manda; si no, lo que soporte la GPU. */
export function usarTexturaLiviana(forzado: ModoTextura, gl: ContextoGl | null | undefined): boolean {
  if (forzado) return forzado === 'liviana';
  return necesitaTexturaLiviana(gl);
}

/** Abre un contexto WebGL 2 de prueba. Devuelve null si no hay WebGL. */
export function sondearGl(): (ContextoGl & { liberar(): void }) | null {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return null;
    return {
      getExtension: (n) => gl.getExtension(n),
      liberar: () => gl.getExtension('WEBGL_lose_context')?.loseContext(),
    };
  } catch {
    return null;
  }
}

/** Decisión completa al arrancar: prueba la GPU, libera el contexto de prueba y devuelve si usar texturas livianas. */
export function decidirTexturaLiviana(busqueda: string, almacen?: Almacen): boolean {
  const gl = sondearGl();
  try {
    return usarTexturaLiviana(modoTexturaForzado(busqueda, almacen), gl);
  } finally {
    gl?.liberar();
  }
}
