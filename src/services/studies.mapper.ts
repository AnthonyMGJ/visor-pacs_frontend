/**
 * Traduce el JSON DICOM (QIDO-RS, "application/dicom+json") que devuelve Orthanc a los modelos que usan las
 * pantallas. Aquí vive todo lo que depende del formato DICOM; las pantallas no conocen etiquetas como 0020000D.
 */

/** Un atributo DICOM en JSON: { vr, Value: [...] }. */
export interface DicomJsonAtributo {
  vr?: string;
  Value?: unknown[];
}

/** Un objeto DICOM en JSON: etiqueta de 8 hexadecimales (sin coma) → atributo. */
export type DicomJson = Record<string, DicomJsonAtributo | undefined>;

/** Etiquetas DICOM que usa el visor. */
export const TAG = {
  studyUid: '0020000D',
  seriesUid: '0020000E',
  sopUid: '00080018',
  studyDate: '00080020',
  studyTime: '00080030',
  modalitiesInStudy: '00080061',
  modality: '00080060',
  studyDescription: '00081030',
  seriesDescription: '0008103E',
  patientName: '00100010',
  patientId: '00100020',
  patientBirthDate: '00100030',
  patientSex: '00100040',
  patientAge: '00101010',
  seriesNumber: '00200011',
  instanceNumber: '00200013',
  imagePositionPatient: '00200032',
  instancesInStudy: '00201208',
  instancesInSeries: '00201209',
} as const;

/** Estudio listo para mostrarse en la lista. */
export interface Study {
  uid: string;
  patientId: string;
  patientName: string;
  /** Edad y sexo juntos, por ejemplo "45M". Vacío si el estudio no los trae. */
  ageSex: string;
  modalities: string[];
  /** "AAAA-MM-DD HH:mm" (o solo la fecha si no hay hora). Vacío si no hay fecha. */
  studyDate: string;
  description: string;
  /** Número de imágenes del estudio; null si Orthanc no lo informó. */
  instances: number | null;
}

function valores(obj: DicomJson, tag: string): unknown[] {
  const v = obj[tag]?.Value;
  return Array.isArray(v) ? v : [];
}

/** Primer valor del atributo como texto ('' si no existe). */
export function valorTexto(obj: DicomJson, tag: string): string {
  const v = valores(obj, tag)[0];
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

/** Primer valor del atributo como número (null si no existe o no es numérico). */
export function valorNumero(obj: DicomJson, tag: string): number | null {
  const v = valores(obj, tag)[0];
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Todos los valores del atributo como números (descarta los que no lo son). */
export function valoresNumericos(obj: DicomJson, tag: string): number[] {
  return valores(obj, tag)
    .map((v) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN))
    .filter((n) => Number.isFinite(n));
}

/** "GARCIA^CARLOS^M" → "GARCIA, CARLOS M". Acepta el PN de DICOM-JSON ({Alphabetic}) o un texto. */
export function nombreDePersona(obj: DicomJson, tag: string = TAG.patientName): string {
  const v = valores(obj, tag)[0];
  const crudo =
    typeof v === 'string'
      ? v
      : v && typeof v === 'object' && typeof (v as { Alphabetic?: unknown }).Alphabetic === 'string'
        ? (v as { Alphabetic: string }).Alphabetic
        : '';
  const partes = crudo.split('^').map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return '';
  const [apellido, ...resto] = partes;
  return resto.length > 0 ? `${apellido}, ${resto.join(' ')}` : (apellido ?? '');
}

function fechaDicom(f: string): { a: number; m: number; d: number } | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(f);
  return m ? { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** "20260915" → "2026-09-15"; "20260915" + "143005" → "2026-09-15 14:30". Vacío si la fecha no es válida. */
export function formatearFechaHora(fecha: string, hora: string): string {
  const f = fechaDicom(fecha);
  if (!f) return '';
  const base = `${f.a}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`;
  const h = /^(\d{2})(\d{2})/.exec(hora);
  return h ? `${base} ${h[1]}:${h[2]}` : base;
}

/** Edad y sexo juntos. Usa PatientAge ("045Y") y, si falta, la calcula con la fecha de nacimiento y la del estudio. */
export function edadYSexo(obj: DicomJson): string {
  const sexo = valorTexto(obj, TAG.patientSex).toUpperCase().charAt(0);
  let edad = '';
  const textoEdad = /^(\d{1,3})([DWMY])$/.exec(valorTexto(obj, TAG.patientAge).toUpperCase());
  if (textoEdad) {
    const n = Number(textoEdad[1]);
    edad = textoEdad[2] === 'Y' ? String(n) : `${n}${textoEdad[2]!.toLowerCase()}`;
  } else {
    const nac = fechaDicom(valorTexto(obj, TAG.patientBirthDate));
    const est = fechaDicom(valorTexto(obj, TAG.studyDate));
    if (nac && est) {
      let años = est.a - nac.a;
      if (est.m < nac.m || (est.m === nac.m && est.d < nac.d)) años -= 1;
      if (años >= 0) edad = String(años);
    }
  }
  return `${edad}${sexo}`;
}

/** Modalidades del estudio, sin repetir y en orden alfabético. */
function modalidades(obj: DicomJson): string[] {
  const lista = valores(obj, TAG.modalitiesInStudy)
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set(lista)).sort();
}

/** Un objeto QIDO-RS de estudio → Study. Devuelve null si no trae el StudyInstanceUID (no se puede abrir). */
export function mapearEstudio(obj: DicomJson): Study | null {
  const uid = valorTexto(obj, TAG.studyUid);
  if (!uid) return null;
  return {
    uid,
    patientId: valorTexto(obj, TAG.patientId),
    patientName: nombreDePersona(obj) || 'SIN NOMBRE',
    ageSex: edadYSexo(obj),
    modalities: modalidades(obj),
    studyDate: formatearFechaHora(valorTexto(obj, TAG.studyDate), valorTexto(obj, TAG.studyTime)),
    description: valorTexto(obj, TAG.studyDescription),
    instances: valorNumero(obj, TAG.instancesInStudy),
  };
}

/** La respuesta completa de QIDO-RS → estudios, del más reciente al más antiguo. Ignora lo que no sea un estudio. */
export function mapearEstudios(respuesta: unknown): Study[] {
  if (!Array.isArray(respuesta)) return [];
  return respuesta
    .map((o) => (o && typeof o === 'object' ? mapearEstudio(o as DicomJson) : null))
    .filter((s): s is Study => s !== null)
    .sort((a, b) => b.studyDate.localeCompare(a.studyDate));
}

/**
 * ¿El estudio cae dentro del rango de fechas? `desde` y `hasta` vienen de un campo de fecha ("AAAA-MM-DD", ambos
 * incluidos); vacío significa "sin límite". Con algún límite puesto, un estudio sin fecha no coincide (CA05.2).
 */
export function estudioEnRango(studyDate: string, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true;
  const dia = /^\d{4}-\d{2}-\d{2}/.exec(studyDate)?.[0];
  if (!dia) return false;
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}
