import type { Rol } from '../types/auth.types';
import { HERRAMIENTAS, type Herramienta } from './tipos';

/**
 * Qué puede hacer cada rol en el visor.
 *
 * El médico usa todas las herramientas. El paciente solo consulta: puede recorrer los cortes, acercar y mover la
 * imagen para verla en el celular, pero no cambia el contraste (ventana y nivel), no mide, no rota, no voltea ni
 * invierte la imagen. Así no saca conclusiones de una imagen alterada ni de medidas sin criterio clínico.
 *
 * Ninguna de estas acciones modifica el estudio guardado en Orthanc (el proxy DICOMweb solo permite lecturas):
 * la restricción es de uso adecuado, no de integridad de los datos.
 */
export interface PermisosVisor {
  /** Herramientas que se pueden asignar al botón izquierdo / a un dedo. */
  herramientas: readonly Herramienta[];
  /** Rotar, voltear, invertir y escribir ventana/nivel. */
  ajustarImagen: boolean;
  /** Borrar mediciones (solo tiene sentido si se puede medir). */
  medir: boolean;
}

const MEDICO: PermisosVisor = { herramientas: HERRAMIENTAS, ajustarImagen: true, medir: true };

const SOLO_CONSULTA: PermisosVisor = {
  herramientas: ['desplazar', 'zoom', 'pan'],
  ajustarImagen: false,
  medir: false,
};

/** Un rol desconocido o ausente recibe el modo más restringido (falla cerrado). */
export function permisosDelVisor(rol: Rol | null | undefined): PermisosVisor {
  return rol === 'MEDICO' ? MEDICO : SOLO_CONSULTA;
}

/**
 * Herramienta con la que se abre una serie: "desplazar" si hay varias imágenes; con una sola, "ventana y nivel"
 * para el médico y "zoom" para quien solo consulta.
 */
export function herramientaInicial(permisos: PermisosVisor, totalImagenes: number): Herramienta {
  if (totalImagenes > 1 && permisos.herramientas.includes('desplazar')) return 'desplazar';
  if (permisos.herramientas.includes('ventana')) return 'ventana';
  return permisos.herramientas.includes('zoom') ? 'zoom' : (permisos.herramientas[0] ?? 'desplazar');
}

export function puedeUsar(permisos: PermisosVisor, herramienta: Herramienta): boolean {
  return permisos.herramientas.includes(herramienta);
}
