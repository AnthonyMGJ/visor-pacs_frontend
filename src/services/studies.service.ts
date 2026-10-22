import { api } from './api';
import { mapearEstudios, type Study } from './studies.mapper';

const RAIZ = '/api/dicomweb';
const DICOM_JSON = 'application/dicom+json';

/** Atributos extra que se piden a Orthanc para la lista (modalidades, imágenes del estudio y edad). */
const CAMPOS_EXTRA = ['00080061', '00201208', '00101010'];

function consultaDeLista(filtros: Record<string, string> = {}): string {
  const pares = [
    ...Object.entries(filtros).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`),
    ...CAMPOS_EXTRA.map((c) => `includefield=${c}`),
  ];
  return pares.join('&');
}

/**
 * Estudios que el usuario puede ver. Al médico (con permiso) le llegan todos; al paciente, solo los suyos:
 * el backend fuerza su PatientID aunque el cliente envíe otro.
 */
export async function listarEstudios(): Promise<Study[]> {
  const res = await api.get<unknown>(`${RAIZ}/studies?${consultaDeLista()}`, { headers: { Accept: DICOM_JSON } });
  return mapearEstudios(res.data);
}

/** Un estudio por su UID (para el encabezado del visor). Null si Orthanc no lo devuelve. */
export async function obtenerEstudio(studyUid: string): Promise<Study | null> {
  const res = await api.get<unknown>(`${RAIZ}/studies?${consultaDeLista({ StudyInstanceUID: studyUid })}`, {
    headers: { Accept: DICOM_JSON },
  });
  return mapearEstudios(res.data).find((s) => s.uid === studyUid) ?? null;
}
