/**
 * Ventana y nivel (Window/Level) ↔ rango de valores que usa Cornerstone. Funciones puras, sin Cornerstone.
 * Usan la función lineal del estándar DICOM (PS3.3 C.11.2.1.2), la misma que aplica Cornerstone, para que los
 * números que ve la persona sean los de la imagen (por ejemplo 1500/-600) y no 1499/-600,5.
 */

export interface RangoVoi {
  lower: number;
  upper: number;
}

export function rangoDeVentana(ventana: number, nivel: number): RangoVoi {
  return { lower: nivel - 0.5 - (ventana - 1) / 2, upper: nivel - 0.5 + (ventana - 1) / 2 };
}

export function ventanaDeRango(rango: RangoVoi): { ventana: number; nivel: number } {
  return { ventana: Math.abs(rango.upper - rango.lower) + 1, nivel: (rango.lower + rango.upper + 1) / 2 };
}

/** Texto del campo → número; null si está vacío o no es un número válido. */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** La ventana debe ser positiva; el nivel puede ser cualquier número. Devuelve null si los valores no sirven. */
export function validarVentanaNivel(ventana: number | null, nivel: number | null): { ventana: number; nivel: number } | null {
  if (ventana === null || nivel === null || ventana <= 0) return null;
  return { ventana, nivel };
}

/** Para mostrar: sin decimales innecesarios. */
export function formatearNumero(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
