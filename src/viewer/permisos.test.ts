import { describe, expect, it } from 'vitest';
import { herramientaInicial, permisosDelVisor, puedeUsar } from './permisos';
import { HERRAMIENTAS } from './tipos';

describe('permisosDelVisor', () => {
  it('el médico tiene todas las herramientas, puede ajustar la imagen y medir', () => {
    const p = permisosDelVisor('MEDICO');
    expect(p.herramientas).toEqual(HERRAMIENTAS);
    expect(p.ajustarImagen).toBe(true);
    expect(p.medir).toBe(true);
  });

  it('el paciente solo consulta: desplazar, zoom y mover; sin ventana/nivel, mediciones ni ajustes', () => {
    const p = permisosDelVisor('PACIENTE');
    expect(p.herramientas).toEqual(['desplazar', 'zoom', 'pan']);
    expect(p.ajustarImagen).toBe(false);
    expect(p.medir).toBe(false);
    for (const h of ['ventana', 'linea', 'angulo'] as const) expect(puedeUsar(p, h)).toBe(false);
  });

  it('sin rol o con un rol que no ve imágenes queda en el modo más restringido (falla cerrado)', () => {
    expect(permisosDelVisor(null)).toEqual(permisosDelVisor('PACIENTE'));
    expect(permisosDelVisor(undefined)).toEqual(permisosDelVisor('PACIENTE'));
    expect(permisosDelVisor('ADMIN')).toEqual(permisosDelVisor('PACIENTE'));
  });
});

describe('herramientaInicial', () => {
  it('con varias imágenes empieza en "desplazar" para cualquier rol', () => {
    expect(herramientaInicial(permisosDelVisor('MEDICO'), 180)).toBe('desplazar');
    expect(herramientaInicial(permisosDelVisor('PACIENTE'), 180)).toBe('desplazar');
  });

  it('con una sola imagen: el médico empieza en "ventana" y el paciente en "zoom"', () => {
    expect(herramientaInicial(permisosDelVisor('MEDICO'), 1)).toBe('ventana');
    expect(herramientaInicial(permisosDelVisor('PACIENTE'), 1)).toBe('zoom');
  });
});
