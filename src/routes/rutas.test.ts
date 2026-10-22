import { describe, expect, it } from 'vitest';
import { rutaInicio } from './rutas';

describe('rutaInicio', () => {
  it('el administrador va a la gestión de cuentas; médico y paciente, a sus estudios', () => {
    expect(rutaInicio('ADMIN')).toBe('/admin');
    expect(rutaInicio('MEDICO')).toBe('/studies');
    expect(rutaInicio('PACIENTE')).toBe('/studies');
  });

  it('sin rol cae en estudios (el guardia de rutas decidirá si puede entrar)', () => {
    expect(rutaInicio(null)).toBe('/studies');
    expect(rutaInicio(undefined)).toBe('/studies');
  });
});
