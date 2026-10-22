import type { SerieCargada } from '../services/dicomweb.service';

/** Herramienta asignada al botón izquierdo del mouse / a un dedo. */
export type Herramienta = 'desplazar' | 'ventana' | 'zoom' | 'pan' | 'linea' | 'angulo';

export const HERRAMIENTAS: readonly Herramienta[] = ['desplazar', 'ventana', 'zoom', 'pan', 'linea', 'angulo'];

/** Lo que el visor informa a la pantalla cada vez que cambia algo que se muestra. */
export interface EstadoVisor {
  /** Imagen actual (0 = la primera). */
  indice: number;
  total: number;
  ventana: number | null;
  nivel: number | null;
  /** 1 = ajustada a la pantalla. */
  zoom: number;
  rotacion: number;
  invertida: boolean;
}

export interface OpcionesMotor {
  alCambiar: (estado: EstadoVisor) => void;
  alError: (mensaje: string) => void;
}

/**
 * Lo que la pantalla puede pedirle al visor. La implementación real usa Cornerstone3D (motorVisor.ts); las
 * pruebas de la pantalla usan una versión simulada, porque Cornerstone necesita WebGL y un navegador real.
 */
export interface MotorVisor {
  mostrarSerie(serie: SerieCargada): Promise<void>;
  seleccionarHerramienta(herramienta: Herramienta): void;
  /** Suma grados a la rotación actual (puede ser negativo). */
  rotar(grados: number): void;
  voltear(eje: 'horizontal' | 'vertical'): void;
  invertir(): void;
  aplicarVentana(ventana: number, nivel: number): void;
  /** Zoom, posición, rotación, volteo, inversión y ventana/nivel vuelven a su valor original. */
  restablecer(): void;
  borrarMediciones(): void;
  redimensionar(): void;
  destruir(): void;
}

export type CrearMotor = (elemento: HTMLDivElement, opciones: OpcionesMotor) => Promise<MotorVisor>;
