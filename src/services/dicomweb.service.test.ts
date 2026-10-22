import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { cargarSerie, listarSeries, origenDeLaApi } from './dicomweb.service';

const inst = (sop: string, n: number) => ({
  '00080018': { vr: 'UI', Value: [sop] },
  '00200013': { vr: 'IS', Value: [n] },
});

describe('dicomweb.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('origenDeLaApi usa el origen de la página cuando no hay VITE_API_URL', () => {
    expect(origenDeLaApi()).toBe(window.location.origin);
  });

  it('listarSeries pide las series del estudio y las mapea', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      data: [{ '0020000E': { Value: ['S1'] }, '00200011': { Value: [1] }, '00080060': { Value: ['CT'] } }],
    });
    const series = await listarSeries('1.2');
    expect(series).toHaveLength(1);
    expect(series[0]!.uid).toBe('S1');
    expect(get.mock.calls[0]![0]).toMatch(/^\/api\/dicomweb\/studies\/1\.2\/series\?/);
  });

  it('cargarSerie devuelve los imageIds en orden y sus metadatos', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [inst('B', 2), inst('A', 1)] });
    const cargada = await cargarSerie('E1', 'S1');
    expect(get.mock.calls[0]![0]).toBe('/api/dicomweb/studies/E1/series/S1/metadata');
    expect(cargada.instancias.map((i) => i.sopUid)).toEqual(['A', 'B']);
    expect(cargada.imageIds).toEqual([
      `wadors:${window.location.origin}/api/dicomweb/studies/E1/series/S1/instances/A/frames/1`,
      `wadors:${window.location.origin}/api/dicomweb/studies/E1/series/S1/instances/B/frames/1`,
    ]);
    expect(cargada.metadatos.get(cargada.imageIds[0]!)?.['00080018']?.Value?.[0]).toBe('A');
    expect(cargada.metadatos.size).toBe(2);
  });

  it('cargarSerie con una respuesta inesperada devuelve una serie vacía', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { error: true } });
    const cargada = await cargarSerie('E1', 'S1');
    expect(cargada.imageIds).toEqual([]);
    expect(cargada.metadatos.size).toBe(0);
  });

  it('propaga el error del servidor', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('403'));
    await expect(listarSeries('1.2')).rejects.toThrow('403');
    await expect(cargarSerie('1.2', 'S')).rejects.toThrow('403');
  });
});
