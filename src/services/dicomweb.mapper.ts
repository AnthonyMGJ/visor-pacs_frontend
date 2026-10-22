import { TAG, valorNumero, valorTexto, valoresNumericos, type DicomJson } from './studies.mapper';

/** Una serie de un estudio, lista para la lista de series del visor. */
export interface Serie {
  uid: string;
  numero: number | null;
  descripcion: string;
  modalidad: string;
  /** Número de imágenes; null si Orthanc no lo informó. */
  instancias: number | null;
}

/** Una imagen (instancia DICOM) de una serie, en el orden en que se recorre. */
export interface Instancia {
  sopUid: string;
  numero: number | null;
  /** Posición del corte en Z (mm), si la imagen la trae. */
  z: number | null;
}

function comoObjetos(respuesta: unknown): DicomJson[] {
  return Array.isArray(respuesta)
    ? respuesta.filter((o): o is DicomJson => !!o && typeof o === 'object' && !Array.isArray(o))
    : [];
}

/** Respuesta QIDO-RS de series → series ordenadas por número (las que no lo traen, al final). */
export function mapearSeries(respuesta: unknown): Serie[] {
  return comoObjetos(respuesta)
    .map((o): Serie | null => {
      const uid = valorTexto(o, TAG.seriesUid);
      if (!uid) return null;
      return {
        uid,
        numero: valorNumero(o, TAG.seriesNumber),
        descripcion: valorTexto(o, TAG.seriesDescription),
        modalidad: valorTexto(o, TAG.modality),
        instancias: valorNumero(o, TAG.instancesInSeries),
      };
    })
    .filter((s): s is Serie => s !== null)
    .sort((a, b) => (a.numero ?? Number.MAX_SAFE_INTEGER) - (b.numero ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Metadatos de una serie (DICOMweb ".../metadata") → imágenes en orden de recorrido: por número de instancia
 * y, si no lo hay, por la posición en Z. Descarta las que no traen SOPInstanceUID.
 */
export function mapearInstancias(metadatos: unknown): Instancia[] {
  return comoObjetos(metadatos)
    .map((o): Instancia | null => {
      const sopUid = valorTexto(o, TAG.sopUid);
      if (!sopUid) return null;
      const posicion = valoresNumericos(o, TAG.imagePositionPatient);
      return { sopUid, numero: valorNumero(o, TAG.instanceNumber), z: posicion.length === 3 ? posicion[2]! : null };
    })
    .filter((i): i is Instancia => i !== null)
    .sort((a, b) => {
      if (a.numero !== null && b.numero !== null && a.numero !== b.numero) return a.numero - b.numero;
      if (a.z !== null && b.z !== null && a.z !== b.z) return a.z - b.z;
      return a.sopUid.localeCompare(b.sopUid);
    });
}

/** Identificador de imagen que entiende el cargador WADO-RS de Cornerstone (primer fotograma de la instancia). */
export function idDeImagen(origen: string, estudio: string, serie: string, sopUid: string): string {
  const raiz = origen.replace(/\/+$/, '');
  const e = encodeURIComponent(estudio);
  const s = encodeURIComponent(serie);
  const i = encodeURIComponent(sopUid);
  return `wadors:${raiz}/api/dicomweb/studies/${e}/series/${s}/instances/${i}/frames/1`;
}
