import { cache, Enums, eventTarget, RenderingEngine, type Types } from '@cornerstonejs/core';
import { wadors } from '@cornerstonejs/dicom-image-loader';
import {
  annotation,
  AngleTool,
  Enums as EnumsHerramientas,
  LengthTool,
  PanTool,
  StackScrollTool,
  ToolGroupManager,
  utilities as utilidadesHerramientas,
  WindowLevelTool,
  ZoomTool,
} from '@cornerstonejs/tools';
import { iniciarCornerstone } from './cornerstone';
import type { CrearMotor, EstadoVisor, Herramienta, MotorVisor } from './tipos';
import { rangoDeVentana, ventanaDeRango } from './ventana';

const NOMBRE_DE: Record<Herramienta, string> = {
  desplazar: StackScrollTool.toolName,
  ventana: WindowLevelTool.toolName,
  zoom: ZoomTool.toolName,
  pan: PanTool.toolName,
  linea: LengthTool.toolName,
  angulo: AngleTool.toolName,
};

interface Asignacion {
  mouseButton?: number;
  numTouchPoints?: number;
}

let contador = 0;

/** Motor vivo de cada elemento y última operación pendiente sobre él (ver crearMotorCornerstone). */
const vivos = new WeakMap<HTMLElement, MotorVisor>();
const pendientes = new WeakMap<HTMLElement, Promise<unknown>>();

/**
 * Visor de imágenes con Cornerstone3D (un solo viewport de pila). Asignaciones:
 *  - botón izquierdo / un dedo: la herramienta elegida; derecho: zoom; central: paneo;
 *  - rueda: recorre la serie (si tiene varias imágenes) o hace zoom (si tiene una);
 *  - dos dedos: zoom con pellizco; tres dedos: paneo.
 */
async function construirMotor(...[elemento, { alCambiar, alError }]: Parameters<CrearMotor>): Promise<MotorVisor> {
  await iniciarCornerstone();
  // Si otro motor sigue sobre este mismo elemento, se libera antes: dos motores no pueden compartirlo.
  vivos.get(elemento)?.destruir();

  const n = ++contador;
  const idMotor = `motor-${n}`;
  const idVista = `vista-${n}`;
  const idGrupo = `grupo-${n}`;

  const motor = new RenderingEngine(idMotor);
  motor.enableElement({
    viewportId: idVista,
    type: Enums.ViewportType.STACK,
    element: elemento,
    defaultOptions: { background: [0, 0, 0] },
  });
  const vista = motor.getViewport(idVista) as Types.IStackViewport;

  const grupo = ToolGroupManager.createToolGroup(idGrupo)!;
  for (const nombre of Object.values(NOMBRE_DE)) grupo.addTool(nombre);
  grupo.addViewport(idVista, idMotor);

  let herramienta: Herramienta = 'ventana';
  let destruido = false;
  let errorAvisado = false;
  let pendiente = 0;

  const presentacion = () =>
    vista.getViewPresentation({ rotation: true, zoom: true, flipHorizontal: true, flipVertical: true });

  function leerEstado(): EstadoVisor {
    const rango = vista.getProperties().voiRange;
    const wl = rango ? ventanaDeRango(rango) : null;
    return {
      indice: Math.max(0, vista.getCurrentImageIdIndex()),
      total: vista.getImageIds().length,
      ventana: wl ? wl.ventana : null,
      nivel: wl ? wl.nivel : null,
      zoom: vista.getZoom(),
      rotacion: presentacion().rotation ?? 0,
      invertida: vista.getProperties().invert === true,
    };
  }

  /** Avisa a la pantalla como máximo una vez por cuadro, aunque lleguen decenas de eventos por segundo. */
  function notificar() {
    if (destruido || pendiente) return;
    pendiente = requestAnimationFrame(() => {
      pendiente = 0;
      if (!destruido) alCambiar(leerEstado());
    });
  }

  function aplicarAsignaciones() {
    const M = EnumsHerramientas.MouseBindings;
    const total = vista.getImageIds().length;
    const porHerramienta = new Map<string, Asignacion[]>();
    const anadir = (nombre: string, a: Asignacion) => porHerramienta.set(nombre, [...(porHerramienta.get(nombre) ?? []), a]);

    anadir(NOMBRE_DE[herramienta], { mouseButton: M.Primary });
    anadir(ZoomTool.toolName, { mouseButton: M.Secondary });
    anadir(ZoomTool.toolName, { numTouchPoints: 2 });
    anadir(PanTool.toolName, { mouseButton: M.Auxiliary });
    anadir(PanTool.toolName, { numTouchPoints: 3 });
    anadir(total > 1 ? StackScrollTool.toolName : ZoomTool.toolName, { mouseButton: M.Wheel });

    for (const nombre of Object.values(NOMBRE_DE)) grupo.setToolPassive(nombre);
    for (const [nombre, asignaciones] of porHerramienta) grupo.setToolActive(nombre, { bindings: asignaciones });
  }

  const eventos = [Enums.Events.STACK_NEW_IMAGE, Enums.Events.VOI_MODIFIED, Enums.Events.CAMERA_MODIFIED];
  eventos.forEach((e) => elemento.addEventListener(e, notificar));

  const alFallarImagen = () => {
    if (errorAvisado || destruido) return;
    errorAvisado = true;
    alError('No se pudo cargar una imagen de la serie.');
  };
  eventTarget.addEventListener(Enums.Events.IMAGE_LOAD_ERROR, alFallarImagen);

  aplicarAsignaciones();

  const api: MotorVisor = {
    async mostrarSerie(serie) {
      errorAvisado = false;
      utilidadesHerramientas.stackPrefetch.disable(elemento);
      cache.purgeCache();
      wadors.metaDataManager.purge();
      for (const [imageId, metadatos] of serie.metadatos) wadors.metaDataManager.add(imageId, metadatos as never);
      await vista.setStack(serie.imageIds, 0);
      if (destruido) return;
      aplicarAsignaciones();
      api.restablecer();
      if (serie.imageIds.length > 1) utilidadesHerramientas.stackPrefetch.enable(elemento);
      vista.render();
      alCambiar(leerEstado());
    },

    seleccionarHerramienta(h) {
      herramienta = h;
      aplicarAsignaciones();
    },

    rotar(grados) {
      const actual = presentacion().rotation ?? 0;
      vista.setViewPresentation({ rotation: (((actual + grados) % 360) + 360) % 360 });
      vista.render();
      notificar();
    },

    voltear(eje) {
      const p = presentacion();
      vista.setViewPresentation(
        eje === 'horizontal' ? { flipHorizontal: !p.flipHorizontal } : { flipVertical: !p.flipVertical },
      );
      vista.render();
      notificar();
    },

    invertir() {
      vista.setProperties({ invert: vista.getProperties().invert !== true });
      vista.render();
      notificar(); // invertir no siempre emite un evento de Cornerstone
    },

    aplicarVentana(ventana, nivel) {
      vista.setProperties({ voiRange: rangoDeVentana(ventana, nivel) });
      vista.render();
      notificar();
    },

    restablecer() {
      vista.resetProperties();
      vista.resetCamera();
      vista.setViewPresentation({ rotation: 0, flipHorizontal: false, flipVertical: false });
      vista.render();
      notificar();
    },

    borrarMediciones() {
      annotation.state.removeAllAnnotations();
      utilidadesHerramientas.triggerAnnotationRenderForViewportIds([idVista]);
    },

    redimensionar() {
      if (!destruido) motor.resize(true, true);
    },

    destruir() {
      if (destruido) return;
      destruido = true;
      if (vivos.get(elemento) === api) vivos.delete(elemento);
      if (pendiente) cancelAnimationFrame(pendiente);
      utilidadesHerramientas.stackPrefetch.disable(elemento);
      eventos.forEach((e) => elemento.removeEventListener(e, notificar));
      eventTarget.removeEventListener(Enums.Events.IMAGE_LOAD_ERROR, alFallarImagen);
      annotation.state.removeAllAnnotations();
      ToolGroupManager.destroyToolGroup(idGrupo);
      motor.destroy();
      // Las imágenes clínicas no deben quedar en memoria al salir del visor.
      cache.purgeCache();
      wadors.metaDataManager.purge();
    },
  };
  vivos.set(elemento, api);
  return api;
}

/**
 * Crea el visor sobre un elemento. Las creaciones sobre el mismo elemento se encolan: en desarrollo React monta cada
 * pantalla dos veces seguidas, y sin esta cola dos motores arrancan a la vez, el primero se destruye y desactiva
 * el elemento que ya usa el segundo.
 */
export const crearMotorCornerstone: CrearMotor = (elemento, opciones) => {
  const anterior = pendientes.get(elemento) ?? Promise.resolve();
  const nuevo = anterior.catch(() => undefined).then(() => construirMotor(elemento, opciones));
  pendientes.set(elemento, nuevo.catch(() => undefined));
  return nuevo;
};
