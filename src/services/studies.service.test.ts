import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { listarEstudios, obtenerEstudio } from './studies.service';

const respuesta = (uid: string, id = 'PRUEBA-0001') => ({
  '0020000D': { vr: 'UI', Value: [uid] },
  '00100020': { vr: 'LO', Value: [id] },
  '00100010': { vr: 'PN', Value: [{ Alphabetic: 'GARCIA^CARLOS' }] },
});

describe('studies.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('listarEstudios pide /api/dicomweb/studies en DICOM-JSON e incluye los campos extra', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [respuesta('1.1'), respuesta('2.2')] });
    const estudios = await listarEstudios();
    expect(estudios.map((e) => e.uid).sort()).toEqual(['1.1', '2.2']);
    const [url, cfg] = get.mock.calls[0]!;
    expect(url).toMatch(/^\/api\/dicomweb\/studies\?/);
    expect(url).toContain('includefield=00080061');
    expect(url).toContain('includefield=00201208');
    expect((cfg as { headers: Record<string, string> }).headers.Accept).toBe('application/dicom+json');
  });

  it('listarEstudios propaga el error del servidor (la pantalla lo traduce)', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('403'));
    await expect(listarEstudios()).rejects.toThrow('403');
  });

  it('obtenerEstudio filtra por StudyInstanceUID y devuelve el que coincide', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [respuesta('1.1'), respuesta('2.2')] });
    const e = await obtenerEstudio('2.2');
    expect(e?.uid).toBe('2.2');
    expect(get.mock.calls[0]![0]).toContain('StudyInstanceUID=2.2');
  });

  it('obtenerEstudio codifica el UID y devuelve null si no vuelve ninguno igual', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [respuesta('1.1')] });
    expect(await obtenerEstudio('9 9')).toBeNull();
    expect(get.mock.calls[0]![0]).toContain('StudyInstanceUID=9%209');
  });
});
