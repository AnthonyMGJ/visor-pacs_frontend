import { describe, expect, it } from 'vitest';
import { formatearNumero, leerNumero, rangoDeVentana, validarVentanaNivel, ventanaDeRango } from './ventana';

describe('ventana y nivel', () => {
  it('convierte ventana/nivel en rango y de vuelta', () => {
    // Función lineal de DICOM: el rango visible va de nivel - ventana/2 a nivel + ventana/2 - 1.
    expect(rangoDeVentana(400, 40)).toEqual({ lower: -160, upper: 239 });
    expect(ventanaDeRango({ lower: -160, upper: 239 })).toEqual({ ventana: 400, nivel: 40 });
  });

  it('es reversible: los valores de la imagen (1500/-600) vuelven iguales', () => {
    expect(ventanaDeRango(rangoDeVentana(1500, -600))).toEqual({ ventana: 1500, nivel: -600 });
    expect(ventanaDeRango(rangoDeVentana(80, 40.5))).toEqual({ ventana: 80, nivel: 40.5 });
  });

  it.each([
    ['120', 120],
    [' -600 ', -600],
    ['12,5', 12.5],
    ['0', 0],
  ])('leerNumero(%j) = %s', (texto, esperado) => {
    expect(leerNumero(texto)).toBe(esperado);
  });

  it.each([[''], ['  '], ['-'], ['.'], ['abc'], ['12abc'], ['Infinity']])('leerNumero(%j) = null', (texto) => {
    expect(leerNumero(texto)).toBeNull();
  });

  it('validarVentanaNivel exige valores y una ventana positiva', () => {
    expect(validarVentanaNivel(400, 40)).toEqual({ ventana: 400, nivel: 40 });
    expect(validarVentanaNivel(400, -1000)).toEqual({ ventana: 400, nivel: -1000 });
    expect(validarVentanaNivel(0, 40)).toBeNull();
    expect(validarVentanaNivel(-5, 40)).toBeNull();
    expect(validarVentanaNivel(null, 40)).toBeNull();
    expect(validarVentanaNivel(400, null)).toBeNull();
  });

  it('formatearNumero quita decimales innecesarios y tolera null', () => {
    expect(formatearNumero(400)).toBe('400');
    expect(formatearNumero(12.34)).toBe('12.3');
    expect(formatearNumero(null)).toBe('');
    expect(formatearNumero(Number.NaN)).toBe('');
  });
});
