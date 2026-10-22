import { describe, expect, it } from 'vitest';
import { idDeImagen, mapearInstancias, mapearSeries } from './dicomweb.mapper';

const serie = (uid: string, numero?: number, desc = '', modalidad = 'CT', n?: number) => ({
  '0020000E': { vr: 'UI', Value: [uid] },
  ...(numero === undefined ? {} : { '00200011': { vr: 'IS', Value: [numero] } }),
  '0008103E': { vr: 'LO', Value: [desc] },
  '00080060': { vr: 'CS', Value: [modalidad] },
  ...(n === undefined ? {} : { '00201209': { vr: 'IS', Value: [n] } }),
});

const instancia = (sop: string, numero?: number, z?: number) => ({
  '00080018': { vr: 'UI', Value: [sop] },
  ...(numero === undefined ? {} : { '00200013': { vr: 'IS', Value: [numero] } }),
  ...(z === undefined ? {} : { '00200032': { vr: 'DS', Value: [-100, -100, z] } }),
});

describe('mapearSeries', () => {
  it('traduce los atributos y ordena por número, dejando al final las que no lo traen', () => {
    const lista = mapearSeries([serie('S3', undefined, 'sin numero'), serie('S2', 2, 'B'), serie('S1', 1, 'A', 'CT', 180)]);
    expect(lista.map((s) => s.uid)).toEqual(['S1', 'S2', 'S3']);
    expect(lista[0]).toEqual({ uid: 'S1', numero: 1, descripcion: 'A', modalidad: 'CT', instancias: 180 });
    expect(lista[2]!.numero).toBeNull();
    expect(lista[2]!.instancias).toBeNull();
  });

  it('descarta objetos sin SeriesInstanceUID y respuestas que no son una lista', () => {
    expect(mapearSeries([{ '00200011': { Value: [1] } }, 'x', null, [1]])).toEqual([]);
    expect(mapearSeries({ error: 1 })).toEqual([]);
  });
});

describe('mapearInstancias', () => {
  it('ordena por número de instancia', () => {
    const l = mapearInstancias([instancia('C', 3), instancia('A', 1), instancia('B', 2)]);
    expect(l.map((i) => i.sopUid)).toEqual(['A', 'B', 'C']);
  });

  it('sin número usa la posición en Z', () => {
    const l = mapearInstancias([instancia('B', undefined, 5), instancia('A', undefined, -5)]);
    expect(l.map((i) => i.sopUid)).toEqual(['A', 'B']);
    expect(l[0]!.z).toBe(-5);
  });

  it('si no hay número ni posición, el orden es estable por SOPInstanceUID', () => {
    const l = mapearInstancias([instancia('b'), instancia('a')]);
    expect(l.map((i) => i.sopUid)).toEqual(['a', 'b']);
  });

  it('descarta las que no traen SOPInstanceUID', () => {
    expect(mapearInstancias([{ '00200013': { Value: [1] } }, instancia('A', 1)]).map((i) => i.sopUid)).toEqual(['A']);
    expect(mapearInstancias('nada')).toEqual([]);
  });

  it('ignora una posición que no tiene tres coordenadas', () => {
    const l = mapearInstancias([{ '00080018': { Value: ['A'] }, '00200032': { Value: [1, 2] } }]);
    expect(l[0]!.z).toBeNull();
  });
});

describe('idDeImagen', () => {
  it('arma el identificador WADO-RS del primer fotograma', () => {
    expect(idDeImagen('http://localhost:5173', '1.2', '3.4', '5.6')).toBe(
      'wadors:http://localhost:5173/api/dicomweb/studies/1.2/series/3.4/instances/5.6/frames/1',
    );
  });

  it('quita la barra final del origen y codifica caracteres raros', () => {
    expect(idDeImagen('http://x:8080/', 'a b', 'c', 'd')).toBe(
      'wadors:http://x:8080/api/dicomweb/studies/a%20b/series/c/instances/d/frames/1',
    );
  });
});
