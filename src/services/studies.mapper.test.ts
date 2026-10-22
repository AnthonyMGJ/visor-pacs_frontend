import { describe, expect, it } from 'vitest';
import {
  edadYSexo,
  estudioEnRango,
  formatearFechaHora,
  mapearEstudio,
  mapearEstudios,
  nombreDePersona,
  valorNumero,
  valorTexto,
  valoresNumericos,
  type DicomJson,
} from './studies.mapper';

const estudio = (extra: DicomJson = {}): DicomJson => ({
  '0020000D': { vr: 'UI', Value: ['1.2.3'] },
  '00100020': { vr: 'LO', Value: ['PRUEBA-0001'] },
  '00100010': { vr: 'PN', Value: [{ Alphabetic: 'GARCIA^CARLOS' }] },
  '00100040': { vr: 'CS', Value: ['M'] },
  '00101010': { vr: 'AS', Value: ['045Y'] },
  '00080061': { vr: 'CS', Value: ['DX'] },
  '00080020': { vr: 'DA', Value: ['20260915'] },
  '00080030': { vr: 'TM', Value: ['143005'] },
  '00081030': { vr: 'LO', Value: ['RADIOGRAFIA DE TORAX'] },
  '00201208': { vr: 'IS', Value: [2] },
  ...extra,
});

describe('lectura de atributos', () => {
  it('valorTexto recorta espacios, convierte números y devuelve vacío si falta', () => {
    expect(valorTexto({ A: { Value: ['  hola '] } }, 'A')).toBe('hola');
    expect(valorTexto({ A: { Value: [7] } }, 'A')).toBe('7');
    expect(valorTexto({}, 'A')).toBe('');
    expect(valorTexto({ A: { Value: [{ x: 1 }] } }, 'A')).toBe('');
  });

  it('valorNumero acepta números y textos numéricos; null en otro caso', () => {
    expect(valorNumero({ A: { Value: [12] } }, 'A')).toBe(12);
    expect(valorNumero({ A: { Value: ['34'] } }, 'A')).toBe(34);
    expect(valorNumero({ A: { Value: [''] } }, 'A')).toBeNull();
    expect(valorNumero({ A: { Value: ['abc'] } }, 'A')).toBeNull();
    expect(valorNumero({}, 'A')).toBeNull();
  });

  it('valoresNumericos descarta lo que no es número', () => {
    expect(valoresNumericos({ A: { Value: [1, '2.5', 'x', null] } }, 'A')).toEqual([1, 2.5]);
    expect(valoresNumericos({}, 'A')).toEqual([]);
  });
});

describe('nombreDePersona', () => {
  it.each([
    [{ Alphabetic: 'GARCIA^CARLOS' }, 'GARCIA, CARLOS'],
    [{ Alphabetic: 'PRUEBA^PACIENTE^CIENTOCHENTA' }, 'PRUEBA, PACIENTE CIENTOCHENTA'],
    [{ Alphabetic: 'SOLO' }, 'SOLO'],
    ['LOPEZ^ANA', 'LOPEZ, ANA'],
    [{ Alphabetic: '^^^' }, ''],
    [{}, ''],
  ])('%j → %s', (pn, esperado) => {
    expect(nombreDePersona({ '00100010': { Value: [pn] } })).toBe(esperado);
  });

  it('devuelve vacío si no hay atributo', () => {
    expect(nombreDePersona({})).toBe('');
  });
});

describe('formatearFechaHora', () => {
  it('combina fecha y hora', () => expect(formatearFechaHora('20260915', '143005')).toBe('2026-09-15 14:30'));
  it('sin hora devuelve solo la fecha', () => expect(formatearFechaHora('20260915', '')).toBe('2026-09-15'));
  it('con fecha inválida devuelve vacío', () => {
    expect(formatearFechaHora('', '143005')).toBe('');
    expect(formatearFechaHora('2026-09-15', '')).toBe('');
  });
});

describe('edadYSexo', () => {
  it('usa PatientAge en años', () => expect(edadYSexo(estudio())).toBe('45M'));
  it('conserva la unidad si no son años', () => {
    expect(edadYSexo(estudio({ '00101010': { Value: ['006M'] } }))).toBe('6mM');
  });
  it('calcula la edad con la fecha de nacimiento si falta PatientAge', () => {
    const o = estudio({ '00101010': undefined, '00100030': { Value: ['19750310'] }, '00100040': { Value: ['F'] } });
    expect(edadYSexo(o)).toBe('51F'); // estudio 2026-09-15
  });
  it('no suma un año si el cumpleaños aún no llegó', () => {
    const o = estudio({ '00101010': undefined, '00100030': { Value: ['19751201'] } });
    expect(edadYSexo(o)).toBe('50M');
  });
  it('solo el sexo si no hay edad ni fecha de nacimiento', () => {
    expect(edadYSexo(estudio({ '00101010': undefined }))).toBe('M');
  });
  it('vacío si no hay ni edad ni sexo', () => {
    expect(edadYSexo({})).toBe('');
  });
});

describe('mapearEstudio', () => {
  it('traduce los atributos a las propiedades del modelo', () => {
    expect(mapearEstudio(estudio())).toEqual({
      uid: '1.2.3',
      patientId: 'PRUEBA-0001',
      patientName: 'GARCIA, CARLOS',
      ageSex: '45M',
      modalities: ['DX'],
      studyDate: '2026-09-15 14:30',
      description: 'RADIOGRAFIA DE TORAX',
      instances: 2,
    });
  });

  it('es tolerante con atributos ausentes', () => {
    const e = mapearEstudio({ '0020000D': { Value: ['9.9'] } });
    expect(e).toEqual({
      uid: '9.9',
      patientId: '',
      patientName: 'SIN NOMBRE',
      ageSex: '',
      modalities: [],
      studyDate: '',
      description: '',
      instances: null,
    });
  });

  it('devuelve null sin StudyInstanceUID', () => {
    expect(mapearEstudio({ '00100020': { Value: ['X'] } })).toBeNull();
  });

  it('quita modalidades repetidas y las ordena', () => {
    const e = mapearEstudio(estudio({ '00080061': { Value: ['US', 'CT', 'CT'] } }));
    expect(e?.modalities).toEqual(['CT', 'US']);
  });
});

describe('mapearEstudios', () => {
  it('ordena del más reciente al más antiguo y descarta lo que no sirve', () => {
    const viejo = estudio({ '0020000D': { Value: ['A'] }, '00080020': { Value: ['20250101'] } });
    const nuevo = estudio({ '0020000D': { Value: ['B'] }, '00080020': { Value: ['20260101'] } });
    const sinUid: DicomJson = { '00100020': { Value: ['X'] } };
    const lista = mapearEstudios([viejo, null, 'texto', sinUid, nuevo]);
    expect(lista.map((s) => s.uid)).toEqual(['B', 'A']);
  });

  it('una respuesta que no es lista da una lista vacía', () => {
    expect(mapearEstudios({ error: true })).toEqual([]);
    expect(mapearEstudios(undefined)).toEqual([]);
  });
});

describe('estudioEnRango', () => {
  it('sin límites todo coincide, también un estudio sin fecha', () => {
    expect(estudioEnRango('2026-09-01 10:15', '', '')).toBe(true);
    expect(estudioEnRango('', '', '')).toBe(true);
  });

  it('incluye los dos extremos del rango', () => {
    expect(estudioEnRango('2026-09-01 10:15', '2026-09-01', '2026-09-01')).toBe(true);
    expect(estudioEnRango('2026-09-01', '2026-08-01', '2026-09-01')).toBe(true);
  });

  it('descarta lo anterior al desde y lo posterior al hasta', () => {
    expect(estudioEnRango('2026-08-12 10:15', '2026-08-13', '')).toBe(false);
    expect(estudioEnRango('2026-09-02 10:15', '', '2026-09-01')).toBe(false);
  });

  it('acepta solo desde o solo hasta', () => {
    expect(estudioEnRango('2026-09-05 08:00', '2026-09-01', '')).toBe(true);
    expect(estudioEnRango('2026-08-05 08:00', '', '2026-09-01')).toBe(true);
  });

  it('con un límite puesto, un estudio sin fecha no coincide', () => {
    expect(estudioEnRango('', '2026-09-01', '')).toBe(false);
    expect(estudioEnRango('', '', '2026-09-01')).toBe(false);
  });
});
