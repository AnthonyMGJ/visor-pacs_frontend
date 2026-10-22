import { API_URL, api } from './api';
import { idDeImagen, mapearInstancias, mapearSeries, type Instancia, type Serie } from './dicomweb.mapper';
import type { DicomJson } from './studies.mapper';

const RAIZ = '/api/dicomweb';
const DICOM_JSON = 'application/dicom+json';

/** Origen absoluto desde el que el cargador de Cornerstone pedirá los fotogramas. */
export function origenDeLaApi(): string {
  return API_URL ? API_URL.replace(/\/+$/, '') : window.location.origin;
}

/** Series de un estudio. 403 si el estudio no es del paciente o el médico no tiene permiso. */
export async function listarSeries(estudio: string): Promise<Serie[]> {
  const url = `${RAIZ}/studies/${encodeURIComponent(estudio)}/series?includefield=0008103E&includefield=00201209`;
  const res = await api.get<unknown>(url, { headers: { Accept: DICOM_JSON } });
  return mapearSeries(res.data);
}

export interface SerieCargada {
  /** Imágenes de la serie en orden de recorrido, con el identificador que usa Cornerstone. */
  imageIds: string[];
  instancias: Instancia[];
  /** Metadatos por imageId: el cargador WADO-RS los necesita antes de pedir cada fotograma. */
  metadatos: Map<string, DicomJson>;
}

/** Pide los metadatos de la serie (una sola petición) y deja listos los imageIds en orden. */
export async function cargarSerie(estudio: string, serie: string): Promise<SerieCargada> {
  const url = `${RAIZ}/studies/${encodeURIComponent(estudio)}/series/${encodeURIComponent(serie)}/metadata`;
  const res = await api.get<unknown>(url, { headers: { Accept: DICOM_JSON } });
  const objetos = Array.isArray(res.data) ? (res.data as DicomJson[]) : [];
  const instancias = mapearInstancias(objetos);
  const origen = origenDeLaApi();
  const imageIds = instancias.map((i) => idDeImagen(origen, estudio, serie, i.sopUid));
  const porSop = new Map<string, DicomJson>();
  for (const o of objetos) {
    const sop = o['00080018']?.Value?.[0];
    if (typeof sop === 'string') porSop.set(sop, o);
  }
  const metadatos = new Map<string, DicomJson>();
  instancias.forEach((inst, i) => {
    const m = porSop.get(inst.sopUid);
    if (m) metadatos.set(imageIds[i]!, m);
  });
  return { imageIds, instancias, metadatos };
}
